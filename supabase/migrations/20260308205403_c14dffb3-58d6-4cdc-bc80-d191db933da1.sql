-- Drop all existing restrictive policies on restaurants
DROP POLICY IF EXISTS "Anyone can view active restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Users can create restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Users can create own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Admins can update own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Super admins can delete restaurants" ON public.restaurants;
-- Recreate as PERMISSIVE policies
CREATE POLICY "Anyone can view active restaurants"
ON public.restaurants FOR SELECT
TO authenticated
USING (
  (status = 'active') OR (owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)
);
CREATE POLICY "Anon can view active restaurants"
ON public.restaurants FOR SELECT
TO anon
USING (status = 'active');
CREATE POLICY "Users can create restaurant"
ON public.restaurants FOR INSERT
TO authenticated
WITH CHECK (
  (owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)
);
CREATE POLICY "Admins can update own restaurant"
ON public.restaurants FOR UPDATE
TO authenticated
USING (
  (owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)
);
CREATE POLICY "Super admins can delete restaurants"
ON public.restaurants FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
);
