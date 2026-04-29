-- Shared menu sync + branch-admin branch scoping

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS shared_menu_item_id uuid REFERENCES public.group_shared_menus(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_restaurant_shared_menu
  ON public.menu_items (restaurant_id, shared_menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_shared_menu_item_id
  ON public.menu_items (shared_menu_item_id);
CREATE OR REPLACE FUNCTION public.is_restaurant_admin(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = _restaurant_id AND owner_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.restaurants r
    JOIN public.restaurant_groups g ON g.id = r.group_id
    WHERE r.id = _restaurant_id AND g.owner_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::public.app_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.staff_restaurants sr
    WHERE sr.user_id = _user_id
      AND sr.restaurant_id = _restaurant_id
      AND sr.role = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_restaurant_admin(uuid, uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.sync_shared_menu_item_to_branches(p_shared_menu_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.group_shared_menus%ROWTYPE;
BEGIN
  SELECT * INTO v_item
  FROM public.group_shared_menus
  WHERE id = p_shared_menu_item_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_item.is_active THEN
    INSERT INTO public.menu_items (
      restaurant_id,
      shared_menu_item_id,
      name,
      description,
      price,
      category,
      image_url,
      available,
      sort_order
    )
    SELECT
      r.id,
      v_item.id,
      v_item.name,
      v_item.description,
      v_item.price,
      v_item.category,
      v_item.image_url,
      true,
      COALESCE((SELECT MAX(mi.sort_order) + 1 FROM public.menu_items mi WHERE mi.restaurant_id = r.id), 0)
    FROM public.restaurants r
    WHERE r.group_id = v_item.group_id
      AND r.is_branch = true
      AND r.status = 'active'
    ON CONFLICT (restaurant_id, shared_menu_item_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      category = EXCLUDED.category,
      image_url = EXCLUDED.image_url,
      available = true,
      updated_at = now();
  ELSE
    UPDATE public.menu_items
    SET available = false,
        updated_at = now()
    WHERE shared_menu_item_id = v_item.id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_shared_menu_item_to_branches(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.sync_shared_menu_to_branch(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch public.restaurants%ROWTYPE;
BEGIN
  SELECT * INTO v_branch
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF NOT FOUND OR v_branch.group_id IS NULL OR v_branch.status <> 'active' THEN
    RETURN;
  END IF;

  INSERT INTO public.menu_items (
    restaurant_id,
    shared_menu_item_id,
    name,
    description,
    price,
    category,
    image_url,
    available,
    sort_order
  )
  SELECT
    v_branch.id,
    gsm.id,
    gsm.name,
    gsm.description,
    gsm.price,
    gsm.category,
    gsm.image_url,
    true,
    COALESCE((SELECT MAX(mi.sort_order) + 1 FROM public.menu_items mi WHERE mi.restaurant_id = v_branch.id), 0)
  FROM public.group_shared_menus gsm
  WHERE gsm.group_id = v_branch.group_id
    AND gsm.is_active = true
  ON CONFLICT (restaurant_id, shared_menu_item_id)
  DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    category = EXCLUDED.category,
    image_url = EXCLUDED.image_url,
    available = true,
    updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_shared_menu_to_branch(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.trg_sync_shared_menu_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_shared_menu_item_to_branches(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_shared_menu_item ON public.group_shared_menus;
CREATE TRIGGER trg_sync_shared_menu_item
  AFTER INSERT OR UPDATE ON public.group_shared_menus
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_shared_menu_item();
CREATE OR REPLACE FUNCTION public.trg_delete_shared_menu_copies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.menu_items
  WHERE shared_menu_item_id = OLD.id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_delete_shared_menu_copies ON public.group_shared_menus;
CREATE TRIGGER trg_delete_shared_menu_copies
  BEFORE DELETE ON public.group_shared_menus
  FOR EACH ROW EXECUTE FUNCTION public.trg_delete_shared_menu_copies();
CREATE OR REPLACE FUNCTION public.trg_sync_branch_shared_menu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS NOT NULL
     AND NEW.is_branch = true
     AND NEW.status = 'active' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.sync_shared_menu_to_branch(NEW.id);
    ELSIF OLD.group_id IS DISTINCT FROM NEW.group_id
       OR OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.sync_shared_menu_to_branch(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_branch_shared_menu ON public.restaurants;
CREATE TRIGGER trg_sync_branch_shared_menu
  AFTER INSERT OR UPDATE OF group_id, status ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_branch_shared_menu();
DO $$
DECLARE
  v_item_id uuid;
BEGIN
  FOR v_item_id IN SELECT id FROM public.group_shared_menus LOOP
    PERFORM public.sync_shared_menu_item_to_branches(v_item_id);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Group owners can view group branches" ON public.restaurants;
DROP POLICY IF EXISTS "Group owners can create branches" ON public.restaurants;
DROP POLICY IF EXISTS "Group owners can update branches" ON public.restaurants;
CREATE POLICY "Group owners can view group branches" ON public.restaurants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurant_groups g
      WHERE g.id = restaurants.group_id
        AND g.owner_id = auth.uid()
    )
  );
CREATE POLICY "Group owners can create branches" ON public.restaurants
  FOR INSERT TO authenticated
  WITH CHECK (
    is_branch = true
    AND group_id IN (
      SELECT id FROM public.restaurant_groups
      WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY "Group owners can update branches" ON public.restaurants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurant_groups g
      WHERE g.id = restaurants.group_id
        AND g.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.restaurant_groups g
      WHERE g.id = restaurants.group_id
        AND g.owner_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Admins can manage menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can manage own restaurant menu" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can insert menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Restaurant admins can manage local menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Head office can manage synced shared menu items" ON public.menu_items;
CREATE POLICY "Restaurant admins can manage local menu items" ON public.menu_items
  FOR ALL TO authenticated
  USING (
    shared_menu_item_id IS NULL
    AND public.is_restaurant_admin(auth.uid(), restaurant_id)
  )
  WITH CHECK (
    shared_menu_item_id IS NULL
    AND public.is_restaurant_admin(auth.uid(), restaurant_id)
  );
CREATE POLICY "Head office can manage synced shared menu items" ON public.menu_items
  FOR ALL TO authenticated
  USING (
    shared_menu_item_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.restaurants r
        JOIN public.restaurant_groups g ON g.id = r.group_id
        WHERE r.id = menu_items.restaurant_id
          AND g.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    shared_menu_item_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.restaurants r
        JOIN public.restaurant_groups g ON g.id = r.group_id
        WHERE r.id = menu_items.restaurant_id
          AND g.owner_id = auth.uid()
      )
    )
  );
DROP POLICY IF EXISTS "Admins can manage tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Restaurant admins can manage tables" ON public.restaurant_tables;
CREATE POLICY "Restaurant admins can manage tables" ON public.restaurant_tables
  FOR ALL TO authenticated
  USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));
DROP POLICY IF EXISTS "staff_restaurants_owner_manage" ON public.staff_restaurants;
DROP POLICY IF EXISTS "staff_restaurants_admin_manage" ON public.staff_restaurants;
CREATE POLICY "staff_restaurants_admin_manage" ON public.staff_restaurants
  FOR ALL TO authenticated
  USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));
DROP POLICY IF EXISTS "user_roles_owner_manage_staff" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_restaurant_admin_manage_staff" ON public.user_roles;
CREATE POLICY "user_roles_restaurant_admin_manage_staff" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_restaurants sr
      WHERE sr.user_id = user_roles.user_id
        AND public.is_restaurant_admin(auth.uid(), sr.restaurant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff_restaurants sr
      WHERE sr.user_id = user_roles.user_id
        AND public.is_restaurant_admin(auth.uid(), sr.restaurant_id)
    )
  );
DROP POLICY IF EXISTS "Restaurant admins can view staff profiles" ON public.profiles;
DROP POLICY IF EXISTS "Restaurant admins can update staff profiles" ON public.profiles;
CREATE POLICY "Restaurant admins can view staff profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_restaurants sr
      WHERE sr.user_id = profiles.id
        AND public.is_restaurant_admin(auth.uid(), sr.restaurant_id)
    )
  );
CREATE POLICY "Restaurant admins can update staff profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_restaurants sr
      WHERE sr.user_id = profiles.id
        AND public.is_restaurant_admin(auth.uid(), sr.restaurant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff_restaurants sr
      WHERE sr.user_id = profiles.id
        AND public.is_restaurant_admin(auth.uid(), sr.restaurant_id)
    )
  );
CREATE OR REPLACE FUNCTION public.get_restaurant_staff(_restaurant_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  restaurant_id uuid,
  role text,
  created_at timestamptz,
  full_name text,
  email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_restaurant_admin(auth.uid(), _restaurant_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    sr.id,
    sr.user_id,
    sr.restaurant_id,
    COALESCE(sr.role::text, 'waiter') AS role,
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
GRANT EXECUTE ON FUNCTION public.get_restaurant_staff(uuid) TO authenticated;
DROP POLICY IF EXISTS "Restaurant owners can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can delete menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can delete menu images" ON storage.objects;
CREATE POLICY "Restaurant admins can upload menu images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND (storage.foldername(name))[1] IN (
      SELECT r.id::text
      FROM public.restaurants r
      WHERE public.is_restaurant_admin(auth.uid(), r.id)
    )
  );
CREATE POLICY "Restaurant admins can update menu images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (storage.foldername(name))[1] IN (
      SELECT r.id::text
      FROM public.restaurants r
      WHERE public.is_restaurant_admin(auth.uid(), r.id)
    )
  );
CREATE POLICY "Restaurant admins can delete menu images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (storage.foldername(name))[1] IN (
      SELECT r.id::text
      FROM public.restaurants r
      WHERE public.is_restaurant_admin(auth.uid(), r.id)
    )
  );
