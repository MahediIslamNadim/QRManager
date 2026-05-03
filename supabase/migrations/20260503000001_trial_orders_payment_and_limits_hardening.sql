-- =============================================================================
-- Trial order/service enablement + DB-level table limit enforcement
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restaurant_can_accept_orders(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = p_restaurant_id
      AND (
        r.status IN ('active', 'active_paid')
        OR (
          r.status = 'trial'
          AND COALESCE(r.subscription_status, 'trial') = 'trial'
          AND COALESCE(r.trial_ends_at, r.trial_end_date)::timestamptz > now()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.restaurant_can_accept_orders(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.insert_order_with_token(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_seat_id uuid,
  p_notes text,
  p_token uuid,
  p_items jsonb,
  p_customer_device_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_menu_item record;
  v_qty int;
  v_total numeric := 0;
  v_session_seat uuid;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_order';
  END IF;

  SELECT seat_id INTO v_session_seat
  FROM public.table_sessions
  WHERE token = p_token
    AND table_id = p_table_id
    AND restaurant_id = p_restaurant_id
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF v_session_seat IS NOT NULL AND v_session_seat IS DISTINCT FROM p_seat_id THEN
    RAISE EXCEPTION 'seat_mismatch';
  END IF;

  IF NOT public.restaurant_can_accept_orders(p_restaurant_id) THEN
    RAISE EXCEPTION 'restaurant_inactive';
  END IF;

  INSERT INTO public.orders (restaurant_id, table_id, seat_id, total, status, notes, customer_device_id)
  VALUES (p_restaurant_id, p_table_id, p_seat_id, 0, 'pending', NULLIF(p_notes, ''), NULLIF(p_customer_device_id, ''))
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;

    SELECT id, name, price INTO v_menu_item
    FROM public.menu_items
    WHERE id = (v_item->>'menu_item_id')::uuid
      AND restaurant_id = p_restaurant_id
      AND available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'menu_item_unavailable:%', (v_item->>'menu_item_id');
    END IF;

    INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity)
    VALUES (v_order_id, v_menu_item.id, v_menu_item.name, v_menu_item.price, v_qty);

    v_total := v_total + (v_menu_item.price * v_qty);
  END LOOP;

  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  RETURN json_build_object('order_id', v_order_id, 'computed_total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_order_with_token(uuid, uuid, uuid, text, uuid, jsonb, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_service_request(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_seat_id uuid,
  p_token uuid,
  p_type text,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
  v_session_seat uuid;
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
  WHERE token = p_token
    AND table_id = p_table_id
    AND restaurant_id = p_restaurant_id
    AND expires_at > now();

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

  IF NOT public.restaurant_can_accept_orders(p_restaurant_id) THEN
    RAISE EXCEPTION 'restaurant_inactive';
  END IF;

  INSERT INTO public.service_requests (restaurant_id, table_id, seat_id, request_type, note)
  VALUES (p_restaurant_id, p_table_id, p_seat_id, p_type, NULLIF(p_notes, ''))
  RETURNING id INTO v_request_id;

  RETURN json_build_object('request_id', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_service_request(uuid, uuid, uuid, uuid, text, text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_restaurant_table_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_max_tables int;
  v_current_count int;
BEGIN
  SELECT COALESCE(tier, plan, 'medium_smart')
  INTO v_tier
  FROM public.restaurants
  WHERE id = NEW.restaurant_id;

  v_max_tables := CASE
    WHEN v_tier IN ('high_smart', 'high_smart_enterprise') THEN -1
    WHEN v_tier = 'medium_smart' THEN 20
    ELSE 20
  END;

  IF v_max_tables = -1 THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
  INTO v_current_count
  FROM public.restaurant_tables
  WHERE restaurant_id = NEW.restaurant_id;

  IF v_current_count >= v_max_tables THEN
    RAISE EXCEPTION 'table_limit_reached';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_restaurant_table_limit_before_insert ON public.restaurant_tables;
CREATE TRIGGER enforce_restaurant_table_limit_before_insert
BEFORE INSERT ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.enforce_restaurant_table_limit();

-- =============================================================================
-- Token-bound customer order reads
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_orders_for_session(
  p_token uuid,
  p_customer_device_id text DEFAULT NULL,
  p_history boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_orders jsonb;
BEGIN
  SELECT restaurant_id, table_id, seat_id
  INTO v_session
  FROM public.table_sessions
  WHERE token = p_token
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  IF p_history THEN
    SELECT COALESCE(jsonb_agg(order_payload ORDER BY (order_payload->>'created_at') DESC), '[]'::jsonb)
    INTO v_orders
    FROM (
      SELECT jsonb_build_object(
        'id', o.id,
        'total', o.total,
        'status', o.status,
        'created_at', o.created_at,
        'items', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', oi.id,
            'name', oi.name,
            'price', oi.price,
            'quantity', oi.quantity,
            'menu_item_id', oi.menu_item_id
          ) ORDER BY oi.created_at)
          FROM public.order_items oi
          WHERE oi.order_id = o.id
        ), '[]'::jsonb)
      ) AS order_payload
      FROM public.orders o
      WHERE o.restaurant_id = v_session.restaurant_id
        AND o.customer_device_id = NULLIF(p_customer_device_id, '')
        AND o.status IN ('delivered', 'completed', 'served', 'cancelled')
        AND o.total > 0
      ORDER BY o.created_at DESC
      LIMIT 50
    ) scoped_orders;

    RETURN COALESCE(v_orders, '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(order_payload ORDER BY (order_payload->>'created_at') DESC), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'total', o.total,
      'status', o.status,
      'created_at', o.created_at,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id,
          'name', oi.name,
          'price', oi.price,
          'quantity', oi.quantity,
          'menu_item_id', oi.menu_item_id
        ) ORDER BY oi.created_at)
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      ), '[]'::jsonb)
    ) AS order_payload
    FROM public.orders o
    WHERE o.restaurant_id = v_session.restaurant_id
      AND o.table_id = v_session.table_id
      AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
      AND o.total > 0
      AND (
        v_session.seat_id IS NULL
        OR o.seat_id = v_session.seat_id
        OR o.seat_id IS NULL
      )
    ORDER BY o.created_at DESC
    LIMIT 10
  ) scoped_orders;

  RETURN COALESCE(v_orders, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_for_session(uuid, text, boolean)
  TO anon, authenticated;

DROP POLICY IF EXISTS "Orders are visible to restaurant stakeholders" ON public.orders;
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders for restaurant" ON public.orders;
DROP POLICY IF EXISTS "Orders are visible to authenticated restaurant staff" ON public.orders;
CREATE POLICY "Orders are visible to authenticated restaurant staff" ON public.orders
  FOR SELECT TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_restaurant_staff(auth.uid(), restaurant_id)
  );

DROP POLICY IF EXISTS "Order items visible to restaurant stakeholders" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Order items visible to authenticated restaurant staff" ON public.order_items;
CREATE POLICY "Order items visible to authenticated restaurant staff" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT o.id
      FROM public.orders o
      WHERE o.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.is_restaurant_staff(auth.uid(), o.restaurant_id)
    )
  );
