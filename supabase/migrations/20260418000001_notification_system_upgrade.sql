-- ============================================================================
-- MIGRATION: Notification system upgrade + restaurants schema alignment
-- Date: April 18, 2026
-- ============================================================================

-- 1. Add restaurant_id to notifications (for admin-targeted notifications)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notifications_restaurant_id
  ON public.notifications(restaurant_id) WHERE restaurant_id IS NOT NULL;
-- 2. Add subscription_status, tier, trial_end_date to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'medium_smart',
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz;
-- Backfill existing rows: map legacy status to new subscription_status
UPDATE public.restaurants SET
  subscription_status = CASE
    WHEN status = 'active_paid' THEN 'active'
    WHEN status = 'inactive' THEN 'expired'
    WHEN status = 'trial' THEN 'trial'
    ELSE 'trial'
  END,
  tier = COALESCE(tier, 'medium_smart'),
  trial_end_date = COALESCE(trial_end_date, trial_ends_at)
WHERE subscription_status IS NULL OR subscription_status = 'trial';
-- 3. Fix status constraint to allow all used values
DO $$
BEGIN
  -- Drop any existing status check constraint
  ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_status_check
  CHECK (status IN ('active', 'pending', 'inactive', 'trial', 'active_paid'));
-- 4. Fix plan constraint to allow new tier names as plan values
DO $$
BEGIN
  ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_plan_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_plan_check
  CHECK (plan IN ('basic', 'premium', 'enterprise', 'medium_smart', 'high_smart'));
-- 5. Helper function: insert notification for all admins of a restaurant
CREATE OR REPLACE FUNCTION public.notify_restaurant_admins(
  p_restaurant_id uuid,
  p_title         text,
  p_message       text,
  p_type          text DEFAULT 'info'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN
    SELECT user_id FROM public.user_roles
    WHERE role = 'admin' AND restaurant_id = p_restaurant_id
  LOOP
    INSERT INTO public.notifications(user_id, restaurant_id, title, message, type)
    VALUES (v_user_id, p_restaurant_id, p_title, p_message, p_type);
  END LOOP;
END;
$$;
-- 6. Trigger function: notify admins on new order or status change
CREATE OR REPLACE FUNCTION public.trg_order_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_restaurant_admins(
      NEW.restaurant_id,
      'নতুন অর্ডার এসেছে',
      'একটি নতুন অর্ডার পেন্ডিং আছে।',
      'info'
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.notify_restaurant_admins(
      NEW.restaurant_id,
      'অর্ডার আপডেট',
      'অর্ডার স্ট্যাটাস পরিবর্তন হয়েছে: ' || NEW.status,
      'info'
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_notification_trigger ON public.orders;
CREATE TRIGGER order_notification_trigger
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_order_notification();
-- 7. Replace complete_admin_signup to set all subscription columns correctly
DROP FUNCTION IF EXISTS public.complete_admin_signup(TEXT, TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.complete_admin_signup(
  p_restaurant_name TEXT,
  p_address         TEXT DEFAULT NULL,
  p_phone           TEXT DEFAULT NULL,
  p_trial_days      INTEGER DEFAULT 14
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
    'trial', 'basic',
    'medium_smart', 'trial',
    v_trial_end, v_trial_end,
    now(), now()
  )
  RETURNING id INTO v_restaurant_id;

  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  VALUES (v_user_id, 'admin'::app_role, v_restaurant_id)
  ON CONFLICT (user_id, role) DO UPDATE SET restaurant_id = v_restaurant_id;

  -- Welcome notification
  INSERT INTO public.notifications(user_id, restaurant_id, title, message, type)
  VALUES (
    v_user_id, v_restaurant_id,
    'স্বাগতম QR Manager-এ!',
    p_trial_days || ' দিনের বিনামূল্যে ট্রায়াল শুরু হয়েছে। সব ফিচার উপভোগ করুন।',
    'success'
  );

  RETURN json_build_object(
    'success', true,
    'restaurant_id', v_restaurant_id,
    'restaurant_name', TRIM(p_restaurant_name),
    'trial_ends_at', v_trial_end,
    'trial_days', p_trial_days,
    'tier', 'medium_smart',
    'subscription_status', 'trial',
    'user_id', v_user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error in complete_admin_signup: %', SQLERRM;
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_admin_signup(TEXT, TEXT, TEXT, INTEGER) TO authenticated;
