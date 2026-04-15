-- ============================================================
-- FIX: All waiter-critical RLS policies + has_role(text) bug
-- ============================================================

-- 1. Fix has_role(uuid, text) — was comparing app_role = text without cast
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role::public.app_role
  );
$$;

-- 2. Fix "Waiters can update tables" — broken by ::text type + allow admin/kitchen too
DROP POLICY IF EXISTS "Waiters can update tables" ON public.restaurant_tables;
CREATE POLICY "Waiters can update tables" ON public.restaurant_tables
  FOR UPDATE TO authenticated
  USING (
    restaurant_id IN (
      SELECT sr.restaurant_id FROM public.staff_restaurants sr
      WHERE sr.user_id = auth.uid()
    )
    AND (
      has_role(auth.uid(), 'waiter'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'kitchen'::app_role)
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT sr.restaurant_id FROM public.staff_restaurants sr
      WHERE sr.user_id = auth.uid()
    )
  );

-- 3. Fix orders policies — replace ::text with ::app_role
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Staff can update own restaurant orders" ON public.orders;
CREATE POLICY "Staff can update own restaurant orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR is_restaurant_staff(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR is_restaurant_staff(auth.uid(), restaurant_id)
  );

-- 4. Fix restaurant_tables admin policy — ::text → ::app_role
DROP POLICY IF EXISTS "Admins can manage tables" ON public.restaurant_tables;
CREATE POLICY "Admins can manage tables" ON public.restaurant_tables
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- 5. Ensure service_requests INSERT works for customers (public) and staff
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_requests'
    AND policyname='Customers can create service requests' AND schemaname='public') THEN
    EXECUTE $p$
      CREATE POLICY "Customers can create service requests"
      ON public.service_requests FOR INSERT WITH CHECK (true)
    $p$;
  END IF;
END $$;

-- 6. notifications — waiter needs SELECT + UPDATE for own notifications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications'
    AND policyname='Users can view own notifications' AND schemaname='public') THEN
    EXECUTE $p$
      CREATE POLICY "Users can view own notifications" ON public.notifications
        FOR SELECT TO authenticated USING (user_id = auth.uid())
    $p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications'
    AND policyname='Users can update own notifications' AND schemaname='public') THEN
    EXECUTE $p$
      CREATE POLICY "Users can update own notifications" ON public.notifications
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())
    $p$;
  END IF;
END $$;
