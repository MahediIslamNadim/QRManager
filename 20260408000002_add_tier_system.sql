-- Migration: Add Tier and Subscription Columns
-- Date: April 8, 2026
-- Purpose: Add tier-based subscription management to restaurants table

-- Step 1: Add tier column
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'medium_smart'
CHECK (tier IN ('medium_smart', 'high_smart'));

-- Step 2: Add billing cycle column
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'
CHECK (billing_cycle IN ('monthly', 'yearly'));

-- Step 3: Add subscription status
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial'
CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled'));

-- Step 4: Add trial dates
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ DEFAULT now();

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days');

-- Step 5: Add subscription dates
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ;

-- Step 6: Add next billing date
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;

-- Step 7: Create subscriptions table for payment history
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('medium_smart', 'high_smart')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount NUMERIC NOT NULL,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'refunded')),
  payment_method TEXT,
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 8: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant_id ON subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_restaurants_tier ON restaurants(tier);
CREATE INDEX IF NOT EXISTS idx_restaurants_subscription_status ON restaurants(subscription_status);

-- Step 9: Add comment for documentation
COMMENT ON COLUMN restaurants.tier IS 'Restaurant subscription tier: medium_smart or high_smart';
COMMENT ON COLUMN restaurants.billing_cycle IS 'Billing frequency: monthly or yearly';
COMMENT ON COLUMN restaurants.subscription_status IS 'Current subscription status: trial, active, expired, cancelled';
COMMENT ON TABLE subscriptions IS 'Payment and subscription history for restaurants';

-- Step 10: Create function to check if trial is expired
CREATE OR REPLACE FUNCTION is_trial_expired(restaurant_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  trial_end TIMESTAMPTZ;
  sub_status TEXT;
BEGIN
  SELECT trial_end_date, subscription_status
  INTO trial_end, sub_status
  FROM restaurants
  WHERE id = restaurant_uuid;
  
  IF sub_status = 'trial' AND now() > trial_end THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create function to get days remaining in trial
CREATE OR REPLACE FUNCTION get_trial_days_remaining(restaurant_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  trial_end TIMESTAMPTZ;
  sub_status TEXT;
  days_left INTEGER;
BEGIN
  SELECT trial_end_date, subscription_status
  INTO trial_end, sub_status
  FROM restaurants
  WHERE id = restaurant_uuid;
  
  IF sub_status != 'trial' THEN
    RETURN 0;
  END IF;
  
  days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (trial_end - now())) / 86400));
  RETURN days_left;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Update existing restaurants to have trial status
UPDATE restaurants
SET 
  subscription_status = 'trial',
  tier = 'medium_smart',
  billing_cycle = 'monthly',
  trial_start_date = created_at,
  trial_end_date = created_at + INTERVAL '30 days'
WHERE subscription_status IS NULL;

-- Success message
SELECT 'Migration completed successfully! Tier system is now active.' AS result;
