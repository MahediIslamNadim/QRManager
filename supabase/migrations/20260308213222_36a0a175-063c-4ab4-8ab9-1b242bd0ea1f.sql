
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'basic',
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'bkash',
  transaction_id text NOT NULL,
  phone_number text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own payment requests
CREATE POLICY "Users can create own payment requests"
ON public.payment_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can view their own payment requests
CREATE POLICY "Users can view own payment requests"
ON public.payment_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Super admins can view all payment requests
CREATE POLICY "Super admins can view all payments"
ON public.payment_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can update payment requests
CREATE POLICY "Super admins can update payments"
ON public.payment_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
