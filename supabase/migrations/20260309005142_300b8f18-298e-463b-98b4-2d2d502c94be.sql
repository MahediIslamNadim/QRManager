-- Allow restaurant owners/admins to view profiles of staff linked to their restaurant
CREATE POLICY "Admins can view staff profiles"
ON public.profiles FOR SELECT
USING (
  id IN (
    SELECT sr.user_id FROM staff_restaurants sr
    JOIN restaurants r ON r.id = sr.restaurant_id
    WHERE r.owner_id = auth.uid()
  )
);