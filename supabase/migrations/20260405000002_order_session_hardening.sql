-- =============================================================================
-- ORDER + SESSION HARDENING MIGRATION
-- Fixes: P0 open order INSERT, P0 public table_sessions, P1 signup broken,
--        P2 customer rating broken
-- All customer-facing writes now go through SECURITY DEFINER functions so the
-- server can enforce token possession before any data is written.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. validate_and_create_session
--    Called by the client immediately after scanning a QR code.
--    - If a valid token for this table is provided → returns it as-is.
--    - Otherwise → creates a new 30-minute session and returns the token.
--    Returns NULL on error (caller should treat as fail-closed).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_and_create_session(
  p_restaurant_id uuid,
  p_table_id      uuid,
  p_token         uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_expires_at timestamptz;
BEGIN
  -- Verify table belongs to the stated restaurant (prevents cross-tenant abuse)
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_tables
    WHERE id = p_table_id AND restaurant_id = p_restaurant_id
  ) THEN
    RETURN NULL;
  END IF;

  -- If a token was supplied, check if it is still valid for this exact table
  IF p_token IS NOT NULL THEN
    SELECT token, expires_at INTO v_session
    FROM public.table_sessions
    WHERE token = p_token
      AND table_id = p_table_id
      AND restaurant_id = p_restaurant_id
      AND expires_at > now();

    IF FOUND THEN
      RETURN json_build_object('token', v_session.token, 'expires_at', v_session.expires_at);
    END IF;
  END IF;

  -- No valid token — create a new 30-minute session
  v_expires_at := now() + interval '30 minutes';
  INSERT INTO public.table_sessions (restaurant_id, table_id, expires_at)
  VALUES (p_restaurant_id, p_table_id, v_expires_at)
  RETURNING token, expires_at INTO v_session;

  RETURN json_build_object('token', v_session.token, 'expires_at', v_session.expires_at);
END;
$$;
-- ---------------------------------------------------------------------------
-- 2. insert_order_with_token
--    Single atomic RPC replacing the two-step client INSERT (orders + items).
--    Validates token possession before writing anything.
--    Price and name are looked up server-side from menu_items; the client
--    only supplies menu_item_id and quantity — no client-trusted total.
--    p_items: '[{"menu_item_id":"uuid","quantity":2},...]'::jsonb
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
  v_order_id     uuid;
  v_item         jsonb;
  v_menu_item    record;
  v_qty          int;
  v_total        numeric := 0;
  v_session_seat uuid;
BEGIN
  -- Validate items array is non-empty
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_order';
  END IF;

  -- Validate token and fetch the session's bound seat
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

  -- Insert order with total = 0; will be updated after items are inserted
  INSERT INTO public.orders (restaurant_id, table_id, seat_id, total, status, notes)
  VALUES (p_restaurant_id, p_table_id, p_seat_id, 0, 'pending', NULLIF(p_notes, ''))
  RETURNING id INTO v_order_id;

  -- Insert items using server-side price/name from menu_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;

    -- Authoritative price and name; verify item belongs to this restaurant and is available
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

  -- Write the server-computed total back to the order row
  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  RETURN json_build_object('order_id', v_order_id, 'computed_total', v_total);
END;
$$;
-- ---------------------------------------------------------------------------
-- 3. submit_order_rating
--    Lets a customer rate a completed order without a public UPDATE policy.
--    Token must still be valid (within 30 min of the session, not the order).
--    Silently ignores if order was already rated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_order_rating(
  p_order_id uuid,
  p_rating   int,
  p_comment  text,
  p_token    uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_id      uuid;
  v_restaurant_id uuid;
BEGIN
  -- Bounds-check rating
  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN false;
  END IF;

  -- Resolve order's table + restaurant
  SELECT table_id, restaurant_id INTO v_table_id, v_restaurant_id
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN RETURN false; END IF;

  -- Validate session token (allow slightly-expired session for post-meal rating:
  -- extend the window to 2 hours so a customer finishing a long meal can still rate)
  IF NOT EXISTS (
    SELECT 1 FROM public.table_sessions
    WHERE token         = p_token
      AND table_id      = v_table_id
      AND restaurant_id = v_restaurant_id
      AND expires_at    > now() - interval '2 hours'
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.orders
  SET rating         = p_rating,
      rating_comment = NULLIF(p_comment, '')
  WHERE id = p_order_id
    AND (rating IS NULL);   -- do not overwrite an existing rating

  RETURN true;
END;
$$;
-- ---------------------------------------------------------------------------
-- 4. complete_admin_signup
--    Called by the client immediately after supabase.auth.signUp() succeeds.
--    Creates the restaurant and assigns the admin role atomically so there is
--    no partial state if the second step fails.
--    Role is hardcoded to 'admin' — prevents privilege escalation via this path.
--    Guard: fails if the caller already has any role (idempotent protection).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_admin_signup(
  p_restaurant_name text,
  p_address         text DEFAULT NULL,
  p_phone           text DEFAULT NULL,
  p_trial_days      int  DEFAULT 14
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_restaurant   record;
  v_trial_ends   timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- Idempotency guard: user must not already have a role
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'already_setup';
  END IF;

  v_trial_ends := now() + (p_trial_days || ' days')::interval;

  INSERT INTO public.restaurants (name, address, phone, plan, owner_id, status, trial_ends_at)
  VALUES (
    p_restaurant_name,
    NULLIF(p_address, ''),
    NULLIF(p_phone, ''),
    'basic',
    v_user_id,
    'active',
    v_trial_ends
  )
  RETURNING * INTO v_restaurant;

  -- Assign 'admin' role — hardcoded, not caller-supplied
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin');

  RETURN json_build_object('restaurant_id', v_restaurant.id);
END;
$$;
-- ---------------------------------------------------------------------------
-- 5. Lock down table_sessions: remove public SELECT + public INSERT
--    All session operations go through validate_and_create_session() above.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view table sessions"   ON public.table_sessions;
DROP POLICY IF EXISTS "Anyone can create table sessions" ON public.table_sessions;
-- ---------------------------------------------------------------------------
-- 6. Lock down orders + order_items INSERT
--    All customer order creation goes through insert_order_with_token() above.
--    Staff/admin INSERT is still allowed via the existing policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can create orders"      ON public.orders;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
-- Staff can still manually create orders (e.g. walk-in without QR)
CREATE POLICY "Staff can create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_restaurant_staff(auth.uid(), restaurant_id)
  );
CREATE POLICY "Staff can create order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders o
      WHERE
        o.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.is_restaurant_staff(auth.uid(), o.restaurant_id)
    )
  );
