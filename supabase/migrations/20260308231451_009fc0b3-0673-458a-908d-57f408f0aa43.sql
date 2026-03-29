
-- Staff-restaurant linkage table
CREATE TABLE public.staff_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

ALTER TABLE public.staff_restaurants ENABLE ROW LEVEL SECURITY;

-- Admins can manage their restaurant's staff
CREATE POLICY "Admins can manage staff_restaurants" ON public.staff_restaurants
  FOR ALL USING (
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Users can view their own staff linkage
CREATE POLICY "Users can view own staff link" ON public.staff_restaurants
  FOR SELECT USING (user_id = auth.uid());

-- Update get_user_restaurant_id to also check staff_restaurants
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.restaurants WHERE owner_id = _user_id LIMIT 1),
    (SELECT restaurant_id FROM public.staff_restaurants WHERE user_id = _user_id LIMIT 1)
  )
$$;
