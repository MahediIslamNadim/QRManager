-- =============================================================================
-- SERVICE REQUESTS
--
-- Splits waiter-call / bill-request signals out of public.orders so those
-- non-order events stop polluting order history, analytics, and status flows.
-- Customer creation goes through a token-validated RPC; restaurant staff handle
-- requests through normal RLS-scoped updates.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.service_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id      uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  seat_id       uuid REFERENCES public.table_seats(id) ON DELETE SET NULL,
  request_type  text NOT NULL CHECK (request_type IN ('waiter_call', 'bill_request')),
  note          text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'handled')),
  handled_at    timestamptz,
  handled_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_requests_restaurant_status_created_idx
  ON public.service_requests (restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS service_requests_table_created_idx
  ON public.service_requests (table_id, created_at DESC);
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service requests are visible to restaurant stakeholders" ON public.service_requests;
CREATE POLICY "Service requests are visible to restaurant stakeholders"
  ON public.service_requests
  FOR SELECT
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_restaurant_staff(auth.uid(), restaurant_id)
  );
DROP POLICY IF EXISTS "Service requests are manageable by restaurant stakeholders" ON public.service_requests;
CREATE POLICY "Service requests are manageable by restaurant stakeholders"
  ON public.service_requests
  FOR UPDATE
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_restaurant_staff(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_restaurant_staff(auth.uid(), restaurant_id)
  );
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'service_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.create_service_request(
  p_restaurant_id uuid,
  p_table_id      uuid,
  p_seat_id       uuid,
  p_token         uuid,
  p_type          text,
  p_notes         text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id    uuid;
  v_session_seat  uuid;
BEGIN
  IF p_type NOT IN ('waiter_call', 'bill_request') THEN
    RAISE EXCEPTION 'invalid_request_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.restaurant_tables
    WHERE id = p_table_id AND restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'invalid_table';
  END IF;

  SELECT seat_id INTO v_session_seat
  FROM public.table_sessions
  WHERE token         = p_token
    AND table_id      = p_table_id
    AND restaurant_id = p_restaurant_id
    AND expires_at    > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF p_seat_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.table_seats
      WHERE id = p_seat_id
        AND table_id = p_table_id
        AND restaurant_id = p_restaurant_id
    ) THEN
      RAISE EXCEPTION 'invalid_seat';
    END IF;
  END IF;

  IF v_session_seat IS NOT NULL AND v_session_seat IS DISTINCT FROM p_seat_id THEN
    RAISE EXCEPTION 'seat_mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.restaurants
    WHERE id = p_restaurant_id AND status IN ('active', 'active_paid')
  ) THEN
    RAISE EXCEPTION 'restaurant_inactive';
  END IF;

  INSERT INTO public.service_requests (
    restaurant_id,
    table_id,
    seat_id,
    request_type,
    note
  )
  VALUES (
    p_restaurant_id,
    p_table_id,
    p_seat_id,
    p_type,
    NULLIF(p_notes, '')
  )
  RETURNING id INTO v_request_id;

  RETURN json_build_object('request_id', v_request_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_service_request(uuid, uuid, uuid, uuid, text, text)
  TO anon, authenticated;
