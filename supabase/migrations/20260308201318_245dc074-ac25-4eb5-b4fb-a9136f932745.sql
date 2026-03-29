-- Fix remaining policies that weren't created due to conflict
-- Drop any existing conflicting policies first
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Public can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view active restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Users can create own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Admins can update own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Super admins can delete restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete roles" ON public.user_roles;

-- orders
CREATE POLICY "Public can view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE status = 'active'));
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'waiter'));
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO authenticated USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'));

-- order_items
CREATE POLICY "Public can view order items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (order_id IN (SELECT id FROM orders));

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- restaurants
CREATE POLICY "Anyone can view active restaurants" ON public.restaurants FOR SELECT USING (status = 'active' OR owner_id = auth.uid() OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Users can create own restaurant" ON public.restaurants FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins can update own restaurant" ON public.restaurants FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR has_role(auth.uid(), 'super_admin')) WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can delete restaurants" ON public.restaurants FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'));

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'super_admin') OR user_id = auth.uid());
CREATE POLICY "Super admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'super_admin'));