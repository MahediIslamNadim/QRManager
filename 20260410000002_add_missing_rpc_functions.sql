-- Migration: Add Missing RPC Functions
-- Date: April 11, 2026
-- Purpose: Add validate_and_create_session, insert_order_with_token, create_service_request functions

-- =====================================================
-- Function 1: validate_and_create_session
-- =====================================================
CREATE OR REPLACE FUNCTION validate_and_create_session(
  p_restaurant_id UUID,
  p_table_id UUID,
  p_token UUID DEFAULT NULL,
  p_seat_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_session RECORD;
  v_new_token UUID;
BEGIN
  -- Check if table exists and is open
  PERFORM 1 FROM restaurant_tables
  WHERE id = p_table_id
    AND restaurant_id = p_restaurant_id
    AND is_open = true;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Table not found or closed');
  END IF;

  -- If token provided, validate it
  IF p_token IS NOT NULL THEN
    SELECT * INTO v_session
    FROM table_sessions
    WHERE token = p_token
      AND restaurant_id = p_restaurant_id
      AND table_id = p_table_id
      AND expires_at > now();

    IF FOUND THEN
      -- Valid existing session
      RETURN json_build_object('valid', true, 'token', v_session.token, 'session_id', v_session.id);
    END IF;
  END IF;

  -- Create new session
  v_new_token := gen_random_uuid();

  INSERT INTO table_sessions (
    restaurant_id,
    table_id,
    token,
    seat_id,
    expires_at
  ) VALUES (
    p_restaurant_id,
    p_table_id,
    v_new_token,
    p_seat_id,
    now() + INTERVAL '30 minutes'
  )
  RETURNING * INTO v_session;

  RETURN json_build_object('valid', true, 'token', v_new_token, 'session_id', v_session.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function 2: insert_order_with_token
-- =====================================================
CREATE OR REPLACE FUNCTION insert_order_with_token(
  p_restaurant_id UUID,
  p_table_id UUID,
  p_seat_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_token UUID,
  p_items JSONB[] DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_order_id UUID;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_item_record RECORD;
BEGIN
  -- Validate token
  PERFORM 1 FROM table_sessions
  WHERE token = p_token
    AND restaurant_id = p_restaurant_id
    AND table_id = COALESCE(p_table_id, table_id)
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;

  -- Create order
  INSERT INTO orders (
    restaurant_id,
    table_id,
    seat_id,
    notes,
    status,
    total
  ) VALUES (
    p_restaurant_id,
    p_table_id,
    p_seat_id,
    p_notes,
    'pending',
    0
  )
  RETURNING id INTO v_order_id;

  -- Insert order items and calculate total
  FOREACH v_item IN ARRAY p_items
  LOOP
    SELECT mi.price, mi.name
    INTO v_item_record
    FROM menu_items mi
    WHERE mi.id = (v_item->>'menu_item_id')::UUID
      AND mi.restaurant_id = p_restaurant_id;

    IF FOUND THEN
      INSERT INTO order_items (
        order_id,
        menu_item_id,
        name,
        price,
        quantity
      ) VALUES (
        v_order_id,
        (v_item->>'menu_item_id')::UUID,
        v_item_record.name,
        v_item_record.price,
        (v_item->>'quantity')::INTEGER
      );

      v_total := v_total + (v_item_record.price * (v_item->>'quantity')::INTEGER);
    END IF;
  END LOOP;

  -- Update order total
  UPDATE orders SET total = v_total WHERE id = v_order_id;

  RETURN json_build_object(
    'order_id', v_order_id,
    'computed_total', v_total,
    'success', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function 3: create_service_request
-- =====================================================
CREATE OR REPLACE FUNCTION create_service_request(
  p_restaurant_id UUID,
  p_table_id UUID DEFAULT NULL,
  p_seat_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_token UUID,
  p_type TEXT DEFAULT 'waiter_call'
)
RETURNS JSON AS $$
DECLARE
  v_request_id UUID;
  v_request_type TEXT;
BEGIN
  -- Validate token
  PERFORM 1 FROM table_sessions
  WHERE token = p_token
    AND restaurant_id = p_restaurant_id
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;

  -- Map type
  IF p_type = 'bill_request' THEN
    v_request_type := 'bill_request';
  ELSE
    v_request_type := 'waiter_call';
  END IF;

  -- Create service request
  INSERT INTO service_requests (
    restaurant_id,
    table_id,
    seat_id,
    request_type,
    note,
    status
  ) VALUES (
    p_restaurant_id,
    p_table_id,
    p_seat_id,
    v_request_type,
    p_notes,
    'pending'
  )
  RETURNING id INTO v_request_id;

  RETURN json_build_object(
    'request_id', v_request_id,
    'success', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function 4: get_user_restaurant_id (fix if missing)
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_restaurant_id(_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_restaurant_id UUID;
BEGIN
  -- Check if user is owner
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE owner_id = _user_id
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    -- Check if user is staff
    SELECT restaurant_id INTO v_restaurant_id
    FROM staff_restaurants
    WHERE user_id = _user_id
    LIMIT 1;
  END IF;

  RETURN v_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
SELECT 'Missing RPC functions added successfully!' AS result;
