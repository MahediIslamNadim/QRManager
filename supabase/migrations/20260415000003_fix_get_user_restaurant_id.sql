-- Fix get_user_restaurant_id: also check staff_restaurants for waiter/kitchen/admin staff
-- Previously only checked restaurants.owner_id — so waiters got restaurantId = null
-- and all their order mutations silently failed.

CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 1. Owner check (admin)
  SELECT id FROM public.restaurants WHERE owner_id = _user_id
  UNION ALL
  -- 2. Staff check (waiter / kitchen / admin staff)
  SELECT restaurant_id FROM public.staff_restaurants WHERE user_id = _user_id
  LIMIT 1
$$;
