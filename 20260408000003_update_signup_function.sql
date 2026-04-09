-- Updated complete_admin_signup function with tier support
-- Run this in Supabase SQL Editor

-- Step 1: Drop old function
DROP FUNCTION IF EXISTS complete_admin_signup(text, text, text, integer);

-- Step 2: Create new function with tier parameters
CREATE OR REPLACE FUNCTION complete_admin_signup(
  p_restaurant_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_trial_days INTEGER DEFAULT 30,
  p_tier TEXT DEFAULT 'medium_smart',
  p_billing_cycle TEXT DEFAULT 'monthly'
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_restaurant_id UUID;
  v_trial_end TIMESTAMPTZ;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: User must be logged in';
  END IF;

  -- Calculate trial end date
  v_trial_end := now() + (p_trial_days || ' days')::INTERVAL;

  -- Create restaurant with tier info
  INSERT INTO restaurants (
    name, 
    address, 
    phone,
    tier,
    billing_cycle,
    subscription_status,
    trial_start_date,
    trial_end_date
  )
  VALUES (
    p_restaurant_name,
    p_address,
    p_phone,
    p_tier,
    p_billing_cycle,
    'trial',
    now(),
    v_trial_end
  )
  RETURNING id INTO v_restaurant_id;

  -- Assign admin role
  INSERT INTO user_roles (user_id, restaurant_id, role)
  VALUES (v_user_id, v_restaurant_id, 'admin');

  -- Return restaurant info
  RETURN json_build_object(
    'restaurant_id', v_restaurant_id,
    'tier', p_tier,
    'billing_cycle', p_billing_cycle,
    'trial_end_date', v_trial_end,
    'success', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
SELECT 'complete_admin_signup function updated successfully!' AS result;
