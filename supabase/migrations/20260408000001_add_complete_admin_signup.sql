-- ============================================================================
-- MIGRATION: Add complete_admin_signup RPC Function
-- Purpose: Fix signup "unauthenticated" error by creating the missing function
-- Date: April 8, 2026
-- ============================================================================

-- Drop function if it exists (for clean re-deployment)
DROP FUNCTION IF EXISTS public.complete_admin_signup(TEXT, TEXT, TEXT, INTEGER);
-- Create the complete_admin_signup function
-- This function atomically creates a restaurant and assigns admin role
CREATE OR REPLACE FUNCTION public.complete_admin_signup(
  p_restaurant_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_trial_days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Function runs with elevated privileges
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_restaurant_id UUID;
  v_trial_end TIMESTAMPTZ;
  v_existing_restaurant_id UUID;
BEGIN
  -- Step 1: Get current authenticated user ID
  v_user_id := auth.uid();
  
  -- Step 2: Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated: User must be logged in';
  END IF;
  
  -- Step 3: Check if user already has a restaurant
  SELECT id INTO v_existing_restaurant_id 
  FROM public.restaurants 
  WHERE owner_id = v_user_id 
  LIMIT 1;
  
  IF v_existing_restaurant_id IS NOT NULL THEN
    RAISE EXCEPTION 'already_setup: User already has a restaurant (ID: %)', v_existing_restaurant_id;
  END IF;
  
  -- Step 4: Validate restaurant name
  IF p_restaurant_name IS NULL OR TRIM(p_restaurant_name) = '' THEN
    RAISE EXCEPTION 'invalid_input: Restaurant name is required';
  END IF;
  
  -- Step 5: Calculate trial end date
  v_trial_end := now() + (p_trial_days || ' days')::INTERVAL;
  
  -- Step 6: Create restaurant
  INSERT INTO public.restaurants (
    name, 
    owner_id, 
    address, 
    phone, 
    status, 
    plan,
    trial_ends_at,
    created_at,
    updated_at
  )
  VALUES (
    TRIM(p_restaurant_name),
    v_user_id,
    NULLIF(TRIM(p_address), ''),
    NULLIF(TRIM(p_phone), ''),
    'active',
    'basic',
    v_trial_end,
    now(),
    now()
  )
  RETURNING id INTO v_restaurant_id;
  
  -- Step 7: Assign admin role to user
  -- Use ON CONFLICT to prevent duplicate role errors
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Step 8: Return success response with restaurant details
  RETURN json_build_object(
    'success', true,
    'restaurant_id', v_restaurant_id,
    'restaurant_name', TRIM(p_restaurant_name),
    'trial_ends_at', v_trial_end,
    'trial_days', p_trial_days,
    'plan', 'basic',
    'user_id', v_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Catch all errors and return detailed error message
    RAISE EXCEPTION 'Error in complete_admin_signup: %', SQLERRM;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.complete_admin_signup(TEXT, TEXT, TEXT, INTEGER) TO authenticated;
-- Add comment for documentation
COMMENT ON FUNCTION public.complete_admin_signup IS 
'Atomically creates a restaurant and assigns admin role during signup. 
This prevents the race condition where a user could have a restaurant but no role.
Parameters:
  - p_restaurant_name: Restaurant name (required)
  - p_address: Restaurant address (optional)
  - p_phone: Restaurant phone (optional)
  - p_trial_days: Free trial duration in days (default: 30)
Returns: JSON object with restaurant_id, trial_ends_at, etc.';
-- ============================================================================
-- ADDITIONAL FIX: Update RLS policy for user_roles if needed
-- ============================================================================

-- Check if we need a more permissive policy for admin self-assignment
-- This allows the SECURITY DEFINER function to insert roles
DO $$
BEGIN
  -- Drop old restrictive policy if it exists
  DROP POLICY IF EXISTS "Super admins can insert roles" ON public.user_roles;
  
  -- Create new policy that allows:
  -- 1. Super admins to insert any role
  -- 2. SECURITY DEFINER functions to insert (bypasses RLS)
  CREATE POLICY "Super admins can insert roles" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (
      public.has_role(auth.uid(), 'super_admin')
    );
    
  -- Note: SECURITY DEFINER functions bypass RLS, so complete_admin_signup
  -- will work even with this restrictive policy
END $$;
-- ============================================================================
-- VERIFICATION QUERIES (Run these after deployment to verify)
-- ============================================================================

-- Check if function exists
-- SELECT routine_name, routine_type 
-- FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name = 'complete_admin_signup';

-- Check function permissions
-- SELECT grantee, privilege_type 
-- FROM information_schema.routine_privileges 
-- WHERE routine_schema = 'public' 
-- AND routine_name = 'complete_admin_signup';

-- ============================================================================;
