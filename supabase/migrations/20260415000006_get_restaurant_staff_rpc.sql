-- ============================================================
-- RPC: get_restaurant_staff
-- Returns staff members with their profile data for a restaurant.
-- SECURITY DEFINER bypasses profiles RLS so admin can always
-- see their own staff names/emails without depending on
-- additional RLS policies being set up.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_restaurant_staff(_restaurant_id UUID)
RETURNS TABLE (
  id          UUID,
  user_id     UUID,
  restaurant_id UUID,
  role        TEXT,
  created_at  TIMESTAMPTZ,
  full_name   TEXT,
  email       TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must own this restaurant OR be super_admin
  IF NOT (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = _restaurant_id AND r.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles ur2 WHERE ur2.user_id = auth.uid() AND ur2.role = 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    sr.id,
    sr.user_id,
    sr.restaurant_id,
    COALESCE(sr.role, 'waiter') AS role,
    sr.created_at,
    p.full_name,
    p.email
  FROM public.staff_restaurants sr
  LEFT JOIN public.profiles p ON p.id = sr.user_id
  WHERE sr.restaurant_id = _restaurant_id
  ORDER BY sr.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_restaurant_staff(UUID) TO authenticated;
-- Also fix the "Admins can view staff profiles" policy (safe to create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'Admins can view staff profiles'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can view staff profiles"
      ON public.profiles FOR SELECT
      USING (
        id IN (
          SELECT sr.user_id FROM public.staff_restaurants sr
          JOIN public.restaurants r ON r.id = sr.restaurant_id
          WHERE r.owner_id = auth.uid()
        )
      )
    $policy$;
  END IF;
END $$;
