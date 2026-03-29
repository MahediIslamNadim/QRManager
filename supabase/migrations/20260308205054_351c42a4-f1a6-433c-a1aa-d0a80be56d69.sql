
-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create own restaurant" ON public.restaurants;

-- Create new INSERT policy that allows super_admins and owners
CREATE POLICY "Users can create restaurant"
ON public.restaurants FOR INSERT
TO authenticated
WITH CHECK (
  (owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)
);
