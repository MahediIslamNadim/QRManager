CREATE POLICY "Super admins can delete payments"
ON public.payment_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
