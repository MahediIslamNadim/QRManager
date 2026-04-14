-- ============================================================
-- Fix: operator does not exist: app_role = text
-- This fixes the user_roles table type casting issue
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure app_role enum exists with correct values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'waiter', 'kitchen');
  ELSE
    -- Add missing values if enum already exists
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'waiter';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'kitchen';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

-- 2. Fix user_roles table — ensure role column uses the enum properly
-- Drop and recreate RLS policies that compare app_role with text
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_all_policy" ON public.user_roles;

-- 3. Recreate policies using proper casting
CREATE POLICY "user_roles_own_select" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_roles_super_admin_all" ON public.user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'::public.app_role
    )
  );

-- 4. Fix staff_restaurants role column (text type is fine — no enum issue there)
ALTER TABLE public.staff_restaurants 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'waiter' 
CHECK (role IN ('admin', 'waiter', 'kitchen'));

-- Update nulls
UPDATE public.staff_restaurants SET role = 'waiter' WHERE role IS NULL;

-- 5. Grant permissions
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO anon;

-- 6. Fix the has_role function to use proper casting
CREATE OR REPLACE FUNCTION public.has_role(check_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = check_role::public.app_role
  );
END;
$$;

-- 7. Fix get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(check_user_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(check_user_id, auth.uid());
  
  SELECT role::TEXT INTO v_role
  FROM public.user_roles
  WHERE user_id = v_user_id
  LIMIT 1;
  
  RETURN v_role;
END;
$$;

SELECT 'app_role operator fix applied successfully!' AS result;
