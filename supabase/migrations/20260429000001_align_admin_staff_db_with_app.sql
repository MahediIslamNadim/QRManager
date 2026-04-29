-- Align admin-staff database access with application behavior.
-- App routes allow admin and super_admin users to manage menus and staff.
-- These policies/functions scope that access to the user's restaurant only.

CREATE OR REPLACE FUNCTION public.is_restaurant_admin(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = _restaurant_id
      AND r.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.staff_restaurants sr
    WHERE sr.user_id = _user_id
      AND sr.restaurant_id = _restaurant_id
      AND sr.role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can manage menu items" ON public.menu_items;
CREATE POLICY "Admins can manage menu items" ON public.menu_items
  FOR ALL TO authenticated
  USING (
    public.is_restaurant_admin(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.is_restaurant_admin(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can view staff profiles" ON public.profiles;
CREATE POLICY "Admins can view staff profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR id IN (
      SELECT sr.user_id
      FROM public.staff_restaurants sr
      WHERE public.is_restaurant_admin(auth.uid(), sr.restaurant_id)
    )
  );

DROP POLICY IF EXISTS "staff_restaurants_owner_manage" ON public.staff_restaurants;
CREATE POLICY "staff_restaurants_owner_manage" ON public.staff_restaurants
  FOR ALL TO authenticated
  USING (
    public.is_restaurant_admin(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.is_restaurant_admin(auth.uid(), restaurant_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Restaurant owners can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can delete menu images" ON storage.objects;

CREATE POLICY "Restaurant owners can upload menu images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.restaurants r
        WHERE r.id::text = (storage.foldername(name))[1]
          AND public.is_restaurant_admin(auth.uid(), r.id)
      )
    )
  );

CREATE POLICY "Restaurant owners can update menu images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.restaurants r
        WHERE r.id::text = (storage.foldername(name))[1]
          AND public.is_restaurant_admin(auth.uid(), r.id)
      )
    )
  );

CREATE POLICY "Restaurant owners can delete menu images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.restaurants r
        WHERE r.id::text = (storage.foldername(name))[1]
          AND public.is_restaurant_admin(auth.uid(), r.id)
      )
    )
  );

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
  IF NOT (
    public.is_restaurant_admin(auth.uid(), _restaurant_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur2
      WHERE ur2.user_id = auth.uid()
        AND ur2.role = 'super_admin'::app_role
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
      sr.role::text,
      (
        SELECT ur.role::text
        FROM public.user_roles ur
        WHERE ur.user_id = sr.user_id
          AND ur.role::text IN ('admin', 'waiter', 'kitchen')
        LIMIT 1
      ),
      'waiter'
    ) AS role,
    sr.created_at,
    p.full_name,
    u.email
  FROM public.staff_restaurants sr
  LEFT JOIN public.profiles p ON p.id = sr.user_id
  LEFT JOIN auth.users u ON u.id = sr.user_id
  WHERE sr.restaurant_id = _restaurant_id
  ORDER BY sr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_staff(UUID) TO authenticated;
