-- Allow waiters to update restaurant_tables (e.g. customer count)
CREATE POLICY "Waiters can update tables"
ON public.restaurant_tables FOR UPDATE
TO authenticated
USING (
  restaurant_id IN (
    SELECT sr.restaurant_id FROM public.staff_restaurants sr
    WHERE sr.user_id = auth.uid()
  )
  AND has_role(auth.uid(), 'waiter'::app_role)
)
WITH CHECK (
  restaurant_id IN (
    SELECT sr.restaurant_id FROM public.staff_restaurants sr
    WHERE sr.user_id = auth.uid()
  )
  AND has_role(auth.uid(), 'waiter'::app_role)
);
