-- Backfill missing user_roles rows for all existing users
-- This fixes accounts that never got a role row assigned.

-- 1. Restaurant owners → admin role
INSERT INTO public.user_roles (user_id, role, restaurant_id)
SELECT
  r.owner_id,
  'admin'::public.app_role,
  r.id
FROM public.restaurants r
WHERE r.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = r.owner_id
      AND ur.role = 'admin'::public.app_role
  );
-- 2. Staff members → their role from staff_restaurants
--    (waiter and kitchen — skip admin since handled above;
--     also skip if kitchen is not yet in enum, handled gracefully)
DO $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  SELECT
    sr.user_id,
    sr.role::public.app_role,
    sr.restaurant_id
  FROM public.staff_restaurants sr
  WHERE sr.role IN ('admin', 'waiter', 'kitchen')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = sr.user_id
        AND ur.role = sr.role::public.app_role
    );
EXCEPTION
  WHEN invalid_text_representation THEN
    -- 'kitchen' not yet in enum; insert only known values
    INSERT INTO public.user_roles (user_id, role, restaurant_id)
    SELECT
      sr.user_id,
      sr.role::public.app_role,
      sr.restaurant_id
    FROM public.staff_restaurants sr
    WHERE sr.role IN ('admin', 'waiter')
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = sr.user_id
          AND ur.role = sr.role::public.app_role
      );
END $$;
