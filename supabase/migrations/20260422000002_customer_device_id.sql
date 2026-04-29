-- Anonymous customer recognition via a persistent device ID
--
-- How it works:
--   1st visit : frontend generates a UUID, stores it in localStorage as "qrm_cid"
--   On order  : device ID is sent along and saved on the order row
--   2nd visit : frontend reads the same UUID → fetches all past orders for that ID
--               → customer is automatically "recognised" without any login
--
-- The ID lives only in the customer's browser. Clearing localStorage resets it.

-- 1. Add the column to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_device_id TEXT;
-- 2. Index so history look-ups are fast
CREATE INDEX IF NOT EXISTS idx_orders_customer_device_id
  ON public.orders (customer_device_id)
  WHERE customer_device_id IS NOT NULL;
-- 3. Rewrite insert_order_with_token to accept + store the device ID
CREATE OR REPLACE FUNCTION public.insert_order_with_token(
  p_restaurant_id    uuid,
  p_table_id         uuid,
  p_seat_id          uuid,
  p_notes            text,
  p_token            uuid,
  p_items            jsonb,          -- [{menu_item_id: "uuid", quantity: N}, ...]
  p_customer_device_id text DEFAULT NULL
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

  -- Seat binding check
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

  -- Insert order with customer_device_id
  INSERT INTO public.orders (restaurant_id, table_id, seat_id, total, status, notes, customer_device_id)
  VALUES (p_restaurant_id, p_table_id, p_seat_id, 0, 'pending', NULLIF(p_notes, ''), NULLIF(p_customer_device_id, ''))
  RETURNING id INTO v_order_id;

  -- Insert items using server-side price/name
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;

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

  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  RETURN json_build_object('order_id', v_order_id, 'computed_total', v_total);
END;
$$;
