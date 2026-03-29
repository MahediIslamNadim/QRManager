
-- Add billing_cycle to payment_requests
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly';

-- Enable realtime for restaurant_tables (orders already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
