-- ============================================================
-- Fix get_restaurant_staff RPC
-- Previous version failed if staff_restaurants.role column
-- didn't exist yet. This version:
--  - Gets email from auth.users (always present, no RLS)
--  - Gets role from user_roles (original column, always exists)
--  - Does NOT reference staff_restaurants.role column
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_restaurant_staff(_restaurant_id UUID)
RETURNS TABLE (
  id            UUID,
  user_id       UUID,
  restaurant_id UUID,
  role          TEXT,
  created_at    TIMESTAMPTZ,
  full_name     TEXT,
  email         TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must own the restaurant or be super_admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = _restaurant_id AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = auth.uid() AND ur2.role = 'super_admin'::app_role
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    sr.id,
    sr.user_id,
    sr.restaurant_id,
    COALESCE(
      (
        SELECT ur.role::text
        FROM public.user_roles ur
        WHERE ur.user_id = sr.user_id
          AND ur.role::text IN ('waiter', 'kitchen', 'admin')
        LIMIT 1
      ),
      'waiter'
    ) AS role,
    sr.created_at,
    p.full_name,
    u.email          -- from auth.users directly — always available, no RLS
  FROM public.staff_restaurants sr
  LEFT JOIN public.profiles p ON p.id = sr.user_id
  LEFT JOIN auth.users u ON u.id = sr.user_id
  WHERE sr.restaurant_id = _restaurant_id
  ORDER BY sr.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_restaurant_staff(UUID) TO authenticated;
