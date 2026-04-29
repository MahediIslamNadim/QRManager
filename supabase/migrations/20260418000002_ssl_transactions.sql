-- ============================================================================
-- MIGRATION: SSL Transactions table for SSLCommerz payment flow
-- Date: April 18, 2026
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ssl_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan          text NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  amount        numeric(10, 2) NOT NULL,
  tran_id       text UNIQUE NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'validated', 'invalid')),
  val_id        text,
  bank_tran_id  text,
  ssl_status    text,
  card_type     text,
  store_amount  numeric(10, 2),
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ssl_transactions_restaurant_id ON public.ssl_transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_ssl_transactions_tran_id ON public.ssl_transactions(tran_id);
CREATE INDEX IF NOT EXISTS idx_ssl_transactions_status ON public.ssl_transactions(status);
ALTER TABLE public.ssl_transactions ENABLE ROW LEVEL SECURITY;
-- Admins can view their own restaurant's transactions
CREATE POLICY "ssl_transactions_admin_select"
ON public.ssl_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND (restaurant_id = ssl_transactions.restaurant_id OR role = 'super_admin')
  )
);
-- Service role (edge functions) handles all inserts/updates — RLS bypassed for service_role;
