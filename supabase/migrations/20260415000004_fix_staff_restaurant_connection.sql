-- ============================================================
-- Fix staff ↔ restaurant connection
-- Problem: waiter accounts were not properly linked to their
-- restaurant because user_roles.restaurant_id was NULL and
-- get_user_restaurant_id only checked owner, not staff.
-- ============================================================

-- 1. Fix get_user_restaurant_id to include staff_restaurants
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id          FROM public.restaurants      WHERE owner_id  = _user_id LIMIT 1),
    (SELECT restaurant_id FROM public.staff_restaurants WHERE user_id = _user_id LIMIT 1)
  )
$$;

-- 2. Backfill restaurant_id in user_roles for existing staff
UPDATE public.user_roles ur
SET restaurant_id = sr.restaurant_id
FROM public.staff_restaurants sr
WHERE sr.user_id = ur.user_id
  AND ur.restaurant_id IS NULL
  AND ur.role IN ('waiter', 'kitchen', 'admin');

-- 3. Backfill user_roles for restaurant owners missing admin row
INSERT INTO public.user_roles (user_id, role, restaurant_id)
SELECT r.owner_id, 'admin'::public.app_role, r.id
FROM public.restaurants r
WHERE r.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = r.owner_id
      AND ur.role = 'admin'::public.app_role
  );

-- 4. Backfill user_roles for staff members missing a role row
INSERT INTO public.user_roles (user_id, role, restaurant_id)
SELECT sr.user_id, sr.role::public.app_role, sr.restaurant_id
FROM public.staff_restaurants sr
WHERE sr.role IN ('waiter', 'kitchen', 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = sr.user_id
      AND ur.role = sr.role::public.app_role
  );
