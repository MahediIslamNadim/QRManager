-- ============================================================
-- FIX: user_roles RLS infinite recursion
-- "user_roles_super_admin_all" policy queried user_roles table
-- INSIDE a policy ON user_roles → infinite recursion.
-- Fix: drop it, replace with has_role() (SECURITY DEFINER, no recursion).
-- Also: create missing profiles for auth users that have none.
-- ============================================================

-- 1. Drop the self-referencing policy
DROP POLICY IF EXISTS "user_roles_super_admin_all" ON public.user_roles;
-- 2. Recreate safe super-admin policy using has_role() (SECURITY DEFINER)
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
-- 3. Fix "Users can view own roles" — was passing ::text to has_role which expects app_role
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
-- 4. Create missing profiles for any auth user that doesn't have one
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
