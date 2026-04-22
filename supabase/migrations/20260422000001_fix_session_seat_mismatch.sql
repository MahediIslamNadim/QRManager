-- Fix seat_mismatch error on order placement
--
-- Problem: validate_and_create_session reuses an existing session token even
-- when that session is already bound to a DIFFERENT seat. Later, when
-- insert_order_with_token checks seat binding, the stored seat_id ≠ p_seat_id
-- and throws seat_mismatch.
--
-- Fix: if the found session is already bound to a different (non-null) seat,
-- fall through and create a brand-new session for the requested seat instead
-- of reusing the mismatched one.

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
      RETURN NULL;
    END IF;
  END IF;

  -- Re-use an existing valid token
  IF p_token IS NOT NULL THEN
    SELECT token, expires_at, seat_id INTO v_session
    FROM public.table_sessions
    WHERE token         = p_token
      AND table_id      = p_table_id
      AND restaurant_id = p_restaurant_id
      AND expires_at    > now();

    IF FOUND THEN
      -- If session is already bound to a DIFFERENT seat, create a new session
      IF p_seat_id IS NOT NULL
         AND v_session.seat_id IS NOT NULL
         AND v_session.seat_id IS DISTINCT FROM p_seat_id THEN
        -- Fall through to create a new session below
        NULL;
      ELSE
        -- Patch seat onto session if not yet bound
        IF p_seat_id IS NOT NULL AND v_session.seat_id IS NULL THEN
          UPDATE public.table_sessions
          SET seat_id = p_seat_id
          WHERE token = v_session.token;
        END IF;
        RETURN json_build_object('token', v_session.token, 'expires_at', v_session.expires_at);
      END IF;
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
