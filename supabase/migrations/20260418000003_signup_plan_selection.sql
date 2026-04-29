-- Migration: Allow plan selection during signup
-- Adds p_plan parameter to complete_admin_signup so users can choose
-- medium_smart or high_smart at registration (both get FREE_TRIAL_DAYS trial).

DROP FUNCTION IF EXISTS public.complete_admin_signup(TEXT, TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.complete_admin_signup(
  p_restaurant_name TEXT,
  p_address         TEXT    DEFAULT NULL,
  p_phone           TEXT    DEFAULT NULL,
  p_trial_days      INTEGER DEFAULT 14,
  p_plan            TEXT    DEFAULT 'medium_smart'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id              UUID;
  v_restaurant_id        UUID;
  v_trial_end            TIMESTAMPTZ;
  v_existing_restaurant  UUID;
  v_safe_plan            TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: User must be logged in';
  END IF;

  SELECT id INTO v_existing_restaurant
  FROM public.restaurants WHERE owner_id = v_user_id LIMIT 1;

  IF v_existing_restaurant IS NOT NULL THEN
    RAISE EXCEPTION 'already_setup: User already has a restaurant (ID: %)', v_existing_restaurant;
  END IF;

  IF p_restaurant_name IS NULL OR TRIM(p_restaurant_name) = '' THEN
    RAISE EXCEPTION 'invalid_input: Restaurant name is required';
  END IF;

  -- Only allow valid trial plans
  IF p_plan NOT IN ('medium_smart', 'high_smart') THEN
    v_safe_plan := 'medium_smart';
  ELSE
    v_safe_plan := p_plan;
  END IF;

  v_trial_end := now() + (p_trial_days || ' days')::INTERVAL;

  INSERT INTO public.restaurants (
    name, owner_id, address, phone,
    status, plan,
    tier, subscription_status,
    trial_ends_at, trial_end_date,
    created_at, updated_at
  ) VALUES (
    TRIM(p_restaurant_name), v_user_id,
    NULLIF(TRIM(COALESCE(p_address, '')), ''),
    NULLIF(TRIM(COALESCE(p_phone, '')), ''),
    'trial', v_safe_plan,
    v_safe_plan, 'trial',
    v_trial_end, v_trial_end,
    now(), now()
  )
  RETURNING id INTO v_restaurant_id;

  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  VALUES (v_user_id, 'admin'::app_role, v_restaurant_id)
  ON CONFLICT (user_id, role) DO UPDATE SET restaurant_id = v_restaurant_id;

  INSERT INTO public.notifications(user_id, restaurant_id, title, message, type)
  VALUES (
    v_user_id, v_restaurant_id,
    'স্বাগতম QR Manager-এ!',
    p_trial_days || ' দিনের বিনামূল্যে ট্রায়াল শুরু হয়েছে। ' ||
    CASE v_safe_plan
      WHEN 'high_smart' THEN 'High Smart'
      ELSE 'Medium Smart'
    END || ' প্যাকেজের সব ফিচার উপভোগ করুন।',
    'success'
  );

  RETURN json_build_object(
    'success', true,
    'restaurant_id', v_restaurant_id,
    'restaurant_name', TRIM(p_restaurant_name),
    'trial_ends_at', v_trial_end,
    'trial_days', p_trial_days,
    'tier', v_safe_plan,
    'plan', v_safe_plan,
    'subscription_status', 'trial',
    'user_id', v_user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in complete_admin_signup: %', SQLERRM;
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_admin_signup(TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
