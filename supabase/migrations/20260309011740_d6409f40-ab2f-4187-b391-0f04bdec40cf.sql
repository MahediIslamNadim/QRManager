-- Allow admins to delete roles for staff linked to their restaurants
CREATE POLICY "Admins can delete staff roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  user_id IN (
    SELECT sr.user_id FROM public.staff_restaurants sr
    JOIN public.restaurants r ON r.id = sr.restaurant_id
    WHERE r.owner_id = auth.uid()
  )
);
