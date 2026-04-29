-- ============================================================
-- COMPREHENSIVE POLICY CLEANUP
-- Fixes:
--  1. user_roles infinite recursion (self-referencing policies)
--  2. Duplicate SELECT policies on user_roles
--  3. Null-qual INSERT policies (any user could set any role)
--  4. has_role(::text) type mismatches in policies
--  5. staff_restaurants policy type issues
--  6. Missing profiles for auth users
-- ============================================================

-- ── user_roles ──────────────────────────────────────────────
DROP POLICY IF EXISTS "user_roles_own_select"            ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_super_admin_all"       ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles"         ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert own role"        ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles"    ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can insert roles"    ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can update roles"    ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete roles"    ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete staff roles"    ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update staff roles"    ON public.user_roles;
-- SELECT: own row OR super_admin via SECURITY DEFINER has_role (no recursion)
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
-- ALL: super_admin full access
CREATE POLICY "user_roles_super_admin_write" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
-- ALL: restaurant owners can manage their own staff roles
CREATE POLICY "user_roles_owner_manage_staff" ON public.user_roles
  FOR ALL TO authenticated
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
-- ── staff_restaurants ────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage staff_restaurants" ON public.staff_restaurants;
DROP POLICY IF EXISTS "Users can view own staff link"        ON public.staff_restaurants;
CREATE POLICY "staff_restaurants_owner_manage" ON public.staff_restaurants
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );
CREATE POLICY "staff_restaurants_own_select" ON public.staff_restaurants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- ── profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
-- ── backfill missing profiles ────────────────────────────────
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
