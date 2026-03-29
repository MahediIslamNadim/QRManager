
-- Drop all restrictive policies and recreate as permissive

-- menu_items
DROP POLICY IF EXISTS "Admins can insert menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can manage own restaurant menu" ON public.menu_items;
DROP POLICY IF EXISTS "Anyone can view available menu items" ON public.menu_items;

CREATE POLICY "Anyone can view menu items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage menu items" ON public.menu_items FOR ALL USING (
  restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)
) WITH CHECK (
  restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- restaurant_tables
DROP POLICY IF EXISTS "Admins can insert tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Admins can manage own restaurant tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Anyone can view tables" ON public.restaurant_tables;

CREATE POLICY "Anyone can view tables" ON public.restaurant_tables FOR SELECT USING (true);
CREATE POLICY "Admins can manage tables" ON public.restaurant_tables FOR ALL USING (
  restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)
) WITH CHECK (
  restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- orders
DROP POLICY IF EXISTS "Admins can manage own restaurant orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders for restaurant" ON public.orders;

CREATE POLICY "Anyone can view orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (
  restaurant_id IN (SELECT id FROM restaurants WHERE status = 'active')
);
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE USING (
  restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'waiter'::app_role)
);

-- order_items
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;

CREATE POLICY "Anyone can view order items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (
  order_id IN (SELECT id FROM orders)
);

-- restaurants
DROP POLICY IF EXISTS "Admins can update own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Admins can view own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Public can view active restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Super admins can do anything with restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Users can create own restaurant" ON public.restaurants;

CREATE POLICY "Anyone can view active restaurants" ON public.restaurants FOR SELECT USING (status = 'active' OR owner_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Users can create own restaurant" ON public.restaurants FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins can update own restaurant" ON public.restaurants FOR UPDATE USING (owner_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins can delete restaurants" ON public.restaurants FOR DELETE USING (has_role(auth.uid(), 'super_admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can create own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Users can create own role" ON public.user_roles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
