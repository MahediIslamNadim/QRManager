-- =============================================================================
-- SEAT ISOLATION MIGRATION
-- Fixes:
--   [P1] Orders SELECT policy was table-scoped — any seat on a shared table
--        could read every other seat's orders.
--   [P1] submit_order_rating only validated table token, not seat token.
--   [P1] callWaiter / requestBill used direct orders INSERT which is now
--        blocked by RLS (public insert was dropped in migration 000002).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Add seat_id column to table_sessions
--    Nullable: sessions created before seat selection have no seat yet.
--    Once the customer picks a seat, validate_and_create_session updates it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.table_sessions
  ADD COLUMN IF NOT EXISTS seat_id uuid REFERENCES public.table_seats(id);


-- ---------------------------------------------------------------------------
-- 2. Rewrite validate_and_create_session to accept and store seat_id
--    - If valid token supplied and caller now has a seat: patch session.
--    - New session: stores seat_id from the start if supplied.
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

  -- Verify seat belongs to this table before attaching it to any session
  IF p_seat_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.table_seats
      WHERE id = p_seat_id AND table_id = p_table_id
    ) THEN
      RETURN NULL;  -- seat/table mismatch — reject outright
    END IF;
  END IF;

  -- If a valid token was supplied, return it (and attach seat if not yet set)
  IF p_token IS NOT NULL THEN
    SELECT token, expires_at INTO v_session
    FROM public.table_sessions
    WHERE token         = p_token
      AND table_id      = p_table_id
      AND restaurant_id = p_restaurant_id
      AND expires_at    > now();

    IF FOUND THEN
      -- Attach seat to the session once the customer has selected their seat
      IF p_seat_id IS NOT NULL THEN
        UPDATE public.table_sessions
        SET seat_id = p_seat_id
        WHERE token = v_session.token AND seat_id IS NULL;
      END IF;
      RETURN json_build_object('token', v_session.token, 'expires_at', v_session.expires_at);
    END IF;
  END IF;

  -- No valid token — create a new 30-minute session
  v_expires_at := now() + interval '30 minutes';
  INSERT INTO public.table_sessions (restaurant_id, table_id, seat_id, expires_at)
  VALUES (p_restaurant_id, p_table_id, p_seat_id, v_expires_at)
  RETURNING token, expires_at INTO v_session;

  RETURN json_build_object('token', v_session.token, 'expires_at', v_session.expires_at);
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. Tighten orders SELECT policy: add seat-level check for anon customers
--    Rule: if the matching session has a seat_id assigned, the customer may
--    only see orders for that seat (or orders with no seat_id, e.g. waiter
--    calls that predate seat selection). Sessions with seat_id = NULL retain
--    full table-level visibility (customer hasn't picked a seat yet).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Orders are visible to restaurant stakeholders" ON public.orders;

CREATE POLICY "Orders are visible to restaurant stakeholders" ON public.orders
  FOR SELECT
  USING (
    -- restaurant owner
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    -- staff scoped to their own restaurant
    OR public.is_restaurant_staff(auth.uid(), restaurant_id)
    -- anon customer: must have an active session for this table,
    -- and if the session has a seat assigned it must match the order's seat
    OR EXISTS (
      SELECT 1 FROM public.table_sessions ts
      WHERE ts.table_id      = orders.table_id
        AND ts.restaurant_id = orders.restaurant_id
        AND ts.expires_at    > now()
        AND (
          ts.seat_id IS NULL            -- not yet seat-scoped → table-level visibility
          OR ts.seat_id = orders.seat_id  -- session seat matches order seat
          OR orders.seat_id IS NULL     -- order has no seat (e.g. legacy / notification)
        )
    )
  );


-- ---------------------------------------------------------------------------
-- 4. Fix submit_order_rating: also enforce seat match
--    Before: checked table token only — any customer at the same table could
--    rate another seat's order. After: session seat must match order seat.
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
  v_seat_id       uuid;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN RETURN false; END IF;

  SELECT table_id, restaurant_id, seat_id
  INTO   v_table_id, v_restaurant_id, v_seat_id
  FROM   public.orders
  WHERE  id = p_order_id;

  IF NOT FOUND THEN RETURN false; END IF;

  -- Validate session token with extended 2-hour window for post-meal rating.
  -- Also enforce seat: if the session has a seat and the order has a seat,
  -- they must match.
  IF NOT EXISTS (
    SELECT 1 FROM public.table_sessions
    WHERE token         = p_token
      AND table_id      = v_table_id
      AND restaurant_id = v_restaurant_id
      AND expires_at    > now() - interval '2 hours'
      AND (
        seat_id IS NULL               -- session has no seat (legacy / before selection)
        OR seat_id = v_seat_id        -- session seat matches order seat
        OR v_seat_id IS NULL          -- order has no seat
      )
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.orders
  SET rating         = p_rating,
      rating_comment = NULLIF(p_comment, '')
  WHERE id = p_order_id
    AND (rating IS NULL);

  RETURN true;
END;
$$;


-- ---------------------------------------------------------------------------
-- 5. insert_notification_order
--    Token-validated RPC for "Call Waiter" and "Request Bill" actions.
--    These are total=0 / no-items orders that signal the waiter; the
--    direct public INSERT path was intentionally removed in migration 000002.
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
  v_order_id     uuid;
  v_session_seat uuid;
BEGIN
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

  -- Seat binding: if session has a seat, caller must claim the same seat
  IF v_session_seat IS NOT NULL AND v_session_seat IS DISTINCT FROM p_seat_id THEN
    RAISE EXCEPTION 'seat_mismatch';
  END IF;

  -- Verify the claimed seat actually belongs to this table
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
