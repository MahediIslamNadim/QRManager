-- Allow admins to update staff profiles
CREATE POLICY "Admins can update staff profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT sr.user_id FROM public.staff_restaurants sr
    JOIN public.restaurants r ON r.id = sr.restaurant_id
    WHERE r.owner_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT sr.user_id FROM public.staff_restaurants sr
    JOIN public.restaurants r ON r.id = sr.restaurant_id
    WHERE r.owner_id = auth.uid()
  )
);