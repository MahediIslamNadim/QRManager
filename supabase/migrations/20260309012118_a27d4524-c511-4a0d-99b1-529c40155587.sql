-- Allow admins to update roles for staff linked to their restaurants
CREATE POLICY "Admins can update staff roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  user_id IN (
    SELECT sr.user_id FROM public.staff_restaurants sr
    JOIN public.restaurants r ON r.id = sr.restaurant_id
    WHERE r.owner_id = auth.uid()
  )
)
WITH CHECK (
  user_id IN (
    SELECT sr.user_id FROM public.staff_restaurants sr
    JOIN public.restaurants r ON r.id = sr.restaurant_id
    WHERE r.owner_id = auth.uid()
  )
);