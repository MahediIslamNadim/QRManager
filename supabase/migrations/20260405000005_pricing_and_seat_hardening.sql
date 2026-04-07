-- =============================================================================
-- PRICING + SEAT WRITE-PATH HARDENING
--
-- [P0] insert_order_with_token trusted client-supplied price/name/total.
--      Fix: look up menu_items server-side; compute total from DB prices.
--      p_total is dropped; p_items now only carries {menu_item_id, quantity}.
--
-- [P1] validate_and_create_session attached a seat_id without verifying the
--      seat belongs to the table. Fix: cross-check table_seats.
--
-- [P1] insert_order_with_token and insert_notification_order validated the
--      token against table+restaurant but did not enforce that the caller's
--      session seat matches the p_seat_id they claim. A same-table attacker
--      could forge orders/notifications for another seat.
--      Fix: if the session has a seat_id, p_seat_id must match it.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Harden validate_and_create_session: verify seat belongs to table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_and_create_session(
  p_restaurant_id uuid,
  p_table_id      uuid,
  p_token         uuid DEFAULT NULL,
  p_seat_id       uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session    record;
  v_expires_at timestamptz;
BEGIN
  -- Verify table belongs to the stated restaurant
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_tables
    WHERE id = p_table_id AND restaurant_id = p_restaurant_id
  ) THEN
    RETURN NULL;
  END IF;

  -- Verify seat belongs to this table (if provided)
  IF p_seat_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.table_seats
      WHERE id = p_seat_id AND table_id = p_table_id
    ) THEN
      RETURN NULL;  -- seat/table mismatch — reject
    END IF;
  END IF;

  -- Re-use an existing valid token (patch seat if now known)
  IF p_token IS NOT NULL THEN
    SELECT token, expires_at INTO v_session
    FROM public.table_sessions
    WHERE token         = p_token
      AND table_id      = p_table_id
      AND restaurant_id = p_restaurant_id
      AND expires_at    > now();

    IF FOUND THEN
      IF p_seat_id IS NOT NULL THEN
        UPDATE public.table_sessions
        SET seat_id = p_seat_id
        WHERE token = v_session.token AND seat_id IS NULL;
      END IF;
      RETURN json_build_object('token', v_session.token, 'expires_at', v_session.expires_at);
    END IF;
  END IF;

  -- Create a new 30-minute session
  v_expires_at := now() + interval '30 minutes';
  INSERT INTO public.table_sessions (restaurant_id, table_id, seat_id, expires_at)
  VALUES (p_restaurant_id, p_table_id, p_seat_id, v_expires_at)
  RETURNING token, expires_at INTO v_session;

  RETURN json_build_object('token', v_session.token, 'expires_at', v_session.expires_at);
END;
$$;


-- ---------------------------------------------------------------------------
-- 2. Rewrite insert_order_with_token: server-side pricing + seat binding
--
--    p_total and per-item price/name are removed from the interface.
--    p_items now only carries: [{menu_item_id: uuid, quantity: int}]
--    The function reads price + name from menu_items and computes the total.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_order_with_token(
  p_restaurant_id uuid,
  p_table_id      uuid,
  p_seat_id       uuid,
  p_notes         text,
  p_token         uuid,
  p_items         jsonb   -- [{menu_item_id: "uuid", quantity: N}, ...]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id    uuid;
  v_item        jsonb;
  v_menu_item   record;
  v_qty         int;
  v_total       numeric := 0;
  v_session_seat uuid;
BEGIN
  -- Validate items array is non-empty
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_order';
  END IF;

  -- Validate token + fetch session seat
  SELECT seat_id INTO v_session_seat
  FROM public.table_sessions
  WHERE token         = p_token
    AND table_id      = p_table_id
    AND restaurant_id = p_restaurant_id
    AND expires_at    > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  -- Seat binding: if the session has a seat assigned, the caller must match it
  IF v_session_seat IS NOT NULL AND v_session_seat IS DISTINCT FROM p_seat_id THEN
    RAISE EXCEPTION 'seat_mismatch';
  END IF;

  -- Validate restaurant is active
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = p_restaurant_id AND status IN ('active', 'active_paid')
  ) THEN
    RAISE EXCEPTION 'restaurant_inactive';
  END IF;

  -- Insert order (total populated after items loop)
  INSERT INTO public.orders (restaurant_id, table_id, seat_id, total, status, notes)
  VALUES (p_restaurant_id, p_table_id, p_seat_id, 0, 'pending', NULLIF(p_notes, ''))
  RETURNING id INTO v_order_id;

  -- Insert items using server-side price/name from menu_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;

    -- Fetch authoritative price and name; verify menu item belongs to restaurant
    SELECT id, name, price INTO v_menu_item
    FROM public.menu_items
    WHERE id            = (v_item->>'menu_item_id')::uuid
      AND restaurant_id = p_restaurant_id
      AND available     = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'menu_item_unavailable:%', (v_item->>'menu_item_id');
    END IF;

    INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity)
    VALUES (v_order_id, v_menu_item.id, v_menu_item.name, v_menu_item.price, v_qty);

    v_total := v_total + (v_menu_item.price * v_qty);
  END LOOP;

  -- Write the server-computed total back to the order
  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  RETURN json_build_object('order_id', v_order_id, 'computed_total', v_total);
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. Harden insert_notification_order: verify seat belongs to table + enforce
--    session seat binding
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_notification_order(
  p_restaurant_id uuid,
  p_table_id      uuid,
  p_seat_id       uuid,
  p_notes         text,
  p_token         uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id    uuid;
  v_session_seat uuid;
BEGIN
  -- Validate token + fetch session seat
  SELECT seat_id INTO v_session_seat
  FROM public.table_sessions
  WHERE token         = p_token
    AND table_id      = p_table_id
    AND restaurant_id = p_restaurant_id
    AND expires_at    > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  -- Seat binding: if the session has a seat, caller must claim the same seat
  IF v_session_seat IS NOT NULL AND v_session_seat IS DISTINCT FROM p_seat_id THEN
    RAISE EXCEPTION 'seat_mismatch';
  END IF;

  -- Verify seat belongs to table (if provided and session is not yet seat-scoped)
  IF p_seat_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.table_seats
      WHERE id = p_seat_id AND table_id = p_table_id
    ) THEN
      RAISE EXCEPTION 'invalid_seat';
    END IF;
  END IF;

  INSERT INTO public.orders (restaurant_id, table_id, seat_id, total, status, notes)
  VALUES (p_restaurant_id, p_table_id, p_seat_id, 0, 'pending', p_notes)
  RETURNING id INTO v_order_id;

  RETURN json_build_object('order_id', v_order_id);
END;
$$;
