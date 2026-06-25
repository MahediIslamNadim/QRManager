-- Remove monthly billing defaults from all tables
-- Application now only uses yearly billing

ALTER TABLE public.payment_requests
  ALTER COLUMN billing_cycle SET DEFAULT 'yearly';

ALTER TABLE public.ssl_transactions
  ALTER COLUMN billing_cycle SET DEFAULT 'yearly';

ALTER TABLE public.restaurants
  ALTER COLUMN billing_cycle SET DEFAULT 'yearly';

-- Update any existing 'monthly' records to 'yearly'
UPDATE public.payment_requests SET billing_cycle = 'yearly' WHERE billing_cycle = 'monthly';
UPDATE public.ssl_transactions SET billing_cycle = 'yearly' WHERE billing_cycle = 'monthly';
UPDATE public.restaurants SET billing_cycle = 'yearly' WHERE billing_cycle = 'monthly';
