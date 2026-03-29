
-- These may already exist from timed-out migration, using IF NOT EXISTS pattern via DO blocks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own role' AND tablename = 'user_roles') THEN
    CREATE POLICY "Users can create own role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert menu items' AND tablename = 'menu_items') THEN
    CREATE POLICY "Admins can insert menu items" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can insert tables' AND tablename = 'restaurant_tables') THEN
    CREATE POLICY "Admins can insert tables" ON public.restaurant_tables FOR INSERT TO authenticated WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
  END IF;
END $$;
