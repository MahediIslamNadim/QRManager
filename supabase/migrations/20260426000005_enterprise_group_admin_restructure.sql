-- Enterprise group admin restructure + package cleanup

CREATE OR REPLACE FUNCTION public.can_manage_enterprise_group(
  p_group_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = 'super_admin'::public.app_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.restaurant_groups g
    JOIN public.restaurants r
      ON r.group_id = g.id
     AND r.is_branch = false
    JOIN public.user_roles ur
      ON ur.user_id = p_user_id
     AND ur.role = 'group_owner'::public.app_role
    WHERE g.id = p_group_id
      AND g.owner_id = p_user_id
      AND COALESCE(r.tier, r.plan) = 'high_smart_enterprise'
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_enterprise_group(uuid, uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.ensure_enterprise_group(
  p_restaurant_id uuid,
  p_group_name text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_group_id uuid;
  v_group_name text;
BEGIN
  SELECT *
  INTO v_restaurant
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;

  IF v_restaurant.owner_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant owner is required';
  END IF;

  IF COALESCE(v_restaurant.tier, v_restaurant.plan) <> 'high_smart_enterprise' THEN
    RAISE EXCEPTION 'Only enterprise restaurants can bootstrap enterprise groups';
  END IF;

  v_group_name := COALESCE(NULLIF(btrim(p_group_name), ''), NULLIF(btrim(v_restaurant.name), ''), 'Enterprise Group');

  IF v_restaurant.group_id IS NOT NULL THEN
    UPDATE public.restaurant_groups
    SET
      owner_id = v_restaurant.owner_id,
      name = COALESCE(NULLIF(name, ''), v_group_name),
      updated_at = now()
    WHERE id = v_restaurant.group_id
    RETURNING id INTO v_group_id;
  END IF;

  IF v_group_id IS NULL THEN
    INSERT INTO public.restaurant_groups (name, owner_id, description)
    VALUES (v_group_name, v_restaurant.owner_id, 'Enterprise head office group')
    RETURNING id INTO v_group_id;
  END IF;

  UPDATE public.restaurants
  SET
    group_id = v_group_id,
    is_branch = false,
    updated_at = now()
  WHERE id = v_restaurant.id;

  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  VALUES (v_restaurant.owner_id, 'group_owner'::public.app_role, v_restaurant.id)
  ON CONFLICT (user_id, role)
  DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id;

  RETURN v_group_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_enterprise_group(uuid, text) TO authenticated;
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
  )
  OR EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = _restaurant_id
      AND r.group_id IS NOT NULL
      AND public.can_manage_enterprise_group(r.group_id, _user_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'super_admin'::public.app_role
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
CREATE TABLE IF NOT EXISTS public.enterprise_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.restaurant_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('all', 'selected')),
  send_email boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.enterprise_notice_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.enterprise_notices(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'in_app', 'delivered', 'partial', 'failed')),
  delivered_in_app_at timestamptz,
  delivered_email_at timestamptz,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notice_id, restaurant_id)
);
CREATE INDEX IF NOT EXISTS idx_enterprise_notices_group_id
  ON public.enterprise_notices (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_notice_targets_notice_id
  ON public.enterprise_notice_targets (notice_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_notice_targets_restaurant_id
  ON public.enterprise_notice_targets (restaurant_id);
ALTER TABLE public.enterprise_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_notice_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enterprise managers can view notices" ON public.enterprise_notices;
DROP POLICY IF EXISTS "Enterprise managers can manage notices" ON public.enterprise_notices;
DROP POLICY IF EXISTS "Enterprise managers can view notice targets" ON public.enterprise_notice_targets;
DROP POLICY IF EXISTS "Enterprise managers can manage notice targets" ON public.enterprise_notice_targets;
CREATE POLICY "Enterprise managers can view notices"
ON public.enterprise_notices
FOR SELECT
TO authenticated
USING (public.can_manage_enterprise_group(group_id));
CREATE POLICY "Enterprise managers can manage notices"
ON public.enterprise_notices
FOR ALL
TO authenticated
USING (public.can_manage_enterprise_group(group_id))
WITH CHECK (public.can_manage_enterprise_group(group_id));
CREATE POLICY "Enterprise managers can view notice targets"
ON public.enterprise_notice_targets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.enterprise_notices n
    WHERE n.id = enterprise_notice_targets.notice_id
      AND public.can_manage_enterprise_group(n.group_id)
  )
);
CREATE POLICY "Enterprise managers can manage notice targets"
ON public.enterprise_notice_targets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.enterprise_notices n
    WHERE n.id = enterprise_notice_targets.notice_id
      AND public.can_manage_enterprise_group(n.group_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.enterprise_notices n
    WHERE n.id = enterprise_notice_targets.notice_id
      AND public.can_manage_enterprise_group(n.group_id)
  )
);
DROP POLICY IF EXISTS "Group owners can view group branches" ON public.restaurants;
DROP POLICY IF EXISTS "Group owners can create branches" ON public.restaurants;
DROP POLICY IF EXISTS "Group owners can update branches" ON public.restaurants;
CREATE POLICY "Group owners can view group branches"
ON public.restaurants
FOR SELECT
TO authenticated
USING (
  is_branch = true
  AND group_id IS NOT NULL
  AND public.can_manage_enterprise_group(group_id)
);
CREATE POLICY "Group owners can create branches"
ON public.restaurants
FOR INSERT
TO authenticated
WITH CHECK (
  is_branch = true
  AND group_id IS NOT NULL
  AND public.can_manage_enterprise_group(group_id)
);
CREATE POLICY "Group owners can update branches"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (
  is_branch = true
  AND group_id IS NOT NULL
  AND public.can_manage_enterprise_group(group_id)
)
WITH CHECK (
  is_branch = true
  AND group_id IS NOT NULL
  AND public.can_manage_enterprise_group(group_id)
);
DROP POLICY IF EXISTS "Head office can manage synced shared menu items" ON public.menu_items;
CREATE POLICY "Head office can manage synced shared menu items"
ON public.menu_items
FOR ALL
TO authenticated
USING (
  shared_menu_item_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = menu_items.restaurant_id
      AND r.group_id IS NOT NULL
      AND public.can_manage_enterprise_group(r.group_id)
  )
)
WITH CHECK (
  shared_menu_item_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = menu_items.restaurant_id
      AND r.group_id IS NOT NULL
      AND public.can_manage_enterprise_group(r.group_id)
  )
);
DROP POLICY IF EXISTS "user_roles_restaurant_admin_manage_staff" ON public.user_roles;
CREATE POLICY "user_roles_restaurant_admin_manage_staff"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  role IN ('admin'::public.app_role, 'waiter'::public.app_role, 'kitchen'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.staff_restaurants sr
    WHERE sr.user_id = user_roles.user_id
      AND public.is_restaurant_admin(auth.uid(), sr.restaurant_id)
  )
)
WITH CHECK (
  role IN ('admin'::public.app_role, 'waiter'::public.app_role, 'kitchen'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.staff_restaurants sr
    WHERE sr.user_id = user_roles.user_id
      AND public.is_restaurant_admin(auth.uid(), sr.restaurant_id)
  )
);
CREATE OR REPLACE FUNCTION public.get_enterprise_dashboard_summary(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_restaurants integer := 0;
  v_active_restaurants integer := 0;
  v_today_orders integer := 0;
  v_today_revenue numeric := 0;
  v_total_menu_items integer := 0;
  v_pending_notices integer := 0;
  v_top_snapshot jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.can_manage_enterprise_group(p_group_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT COUNT(*)
  INTO v_total_restaurants
  FROM public.restaurants r
  WHERE r.group_id = p_group_id
    AND r.is_branch = true;

  SELECT COUNT(*)
  INTO v_active_restaurants
  FROM public.restaurants r
  WHERE r.group_id = p_group_id
    AND r.is_branch = true
    AND r.status IN ('active', 'active_paid');

  SELECT
    COUNT(*),
    COALESCE(SUM(o.total), 0)
  INTO v_today_orders, v_today_revenue
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.group_id = p_group_id
    AND r.is_branch = true
    AND o.status <> 'cancelled'
    AND o.created_at >= date_trunc('day', now());

  SELECT COUNT(*)
  INTO v_total_menu_items
  FROM public.menu_items mi
  JOIN public.restaurants r ON r.id = mi.restaurant_id
  WHERE r.group_id = p_group_id
    AND r.is_branch = true;

  SELECT COUNT(*)
  INTO v_pending_notices
  FROM public.enterprise_notices n
  WHERE n.group_id = p_group_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(top_rows)), '[]'::jsonb)
  INTO v_top_snapshot
  FROM (
    SELECT
      o.restaurant_id,
      r.name AS restaurant_name,
      oi.name AS item_name,
      SUM(oi.quantity)::integer AS quantity,
      SUM(oi.quantity * oi.price)::numeric AS revenue
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE r.group_id = p_group_id
      AND r.is_branch = true
      AND o.status <> 'cancelled'
    GROUP BY o.restaurant_id, r.name, oi.name
    ORDER BY SUM(oi.quantity * oi.price) DESC, SUM(oi.quantity) DESC
    LIMIT 5
  ) AS top_rows;

  RETURN jsonb_build_object(
    'total_restaurants', v_total_restaurants,
    'active_restaurants', v_active_restaurants,
    'today_orders', v_today_orders,
    'today_revenue', COALESCE(v_today_revenue, 0),
    'total_menu_items', v_total_menu_items,
    'pending_notices', v_pending_notices,
    'top_snapshot', v_top_snapshot
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_enterprise_dashboard_summary(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_enterprise_restaurant_list(p_group_id uuid)
RETURNS TABLE (
  restaurant_id uuid,
  name text,
  address text,
  phone text,
  status text,
  branch_code text,
  subscription_status text,
  created_at timestamptz,
  today_orders integer,
  today_revenue numeric,
  total_orders integer,
  total_revenue numeric,
  menu_items_count integer,
  staff_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_enterprise_group(p_group_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.address,
    r.phone,
    r.status,
    r.branch_code,
    r.subscription_status,
    r.created_at,
    COALESCE(today_stats.today_orders, 0)::integer,
    COALESCE(today_stats.today_revenue, 0),
    COALESCE(total_stats.total_orders, 0)::integer,
    COALESCE(total_stats.total_revenue, 0),
    COALESCE(menu_stats.menu_items_count, 0)::integer,
    COALESCE(staff_stats.staff_count, 0)::integer
  FROM public.restaurants r
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS today_orders, COALESCE(SUM(o.total), 0) AS today_revenue
    FROM public.orders o
    WHERE o.restaurant_id = r.id
      AND o.status <> 'cancelled'
      AND o.created_at >= date_trunc('day', now())
  ) today_stats ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total_orders, COALESCE(SUM(o.total), 0) AS total_revenue
    FROM public.orders o
    WHERE o.restaurant_id = r.id
      AND o.status <> 'cancelled'
  ) total_stats ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS menu_items_count
    FROM public.menu_items mi
    WHERE mi.restaurant_id = r.id
  ) menu_stats ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT sr.user_id) AS staff_count
    FROM public.staff_restaurants sr
    WHERE sr.restaurant_id = r.id
  ) staff_stats ON true
  WHERE r.group_id = p_group_id
    AND r.is_branch = true
  ORDER BY r.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_enterprise_restaurant_list(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_enterprise_top_selling(p_group_id uuid)
RETURNS TABLE (
  restaurant_id uuid,
  restaurant_name text,
  item_name text,
  quantity integer,
  revenue numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_enterprise_group(p_group_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT
    o.restaurant_id,
    r.name,
    oi.name,
    SUM(oi.quantity)::integer AS quantity,
    SUM(oi.quantity * oi.price)::numeric AS revenue
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.group_id = p_group_id
    AND r.is_branch = true
    AND o.status <> 'cancelled'
  GROUP BY o.restaurant_id, r.name, oi.name
  ORDER BY SUM(oi.quantity * oi.price) DESC, SUM(oi.quantity) DESC
  LIMIT 30;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_enterprise_top_selling(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_enterprise_analytics(
  p_group_id uuid,
  p_restaurant_id uuid DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue numeric := 0;
  v_total_orders integer := 0;
  v_avg_order_value numeric := 0;
  v_restaurant_breakdown jsonb := '[]'::jsonb;
  v_daily_trend jsonb := '[]'::jsonb;
  v_category_breakdown jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.can_manage_enterprise_group(p_group_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_restaurant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = p_restaurant_id
      AND r.group_id = p_group_id
      AND r.is_branch = true
  ) THEN
    RAISE EXCEPTION 'Restaurant does not belong to this enterprise group';
  END IF;

  SELECT
    COALESCE(SUM(o.total), 0),
    COUNT(*)
  INTO v_total_revenue, v_total_orders
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.group_id = p_group_id
    AND r.is_branch = true
    AND o.status <> 'cancelled'
    AND (p_restaurant_id IS NULL OR o.restaurant_id = p_restaurant_id);

  IF v_total_orders > 0 THEN
    v_avg_order_value := ROUND(v_total_revenue / v_total_orders, 2);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)
  INTO v_restaurant_breakdown
  FROM (
    SELECT
      r.id AS restaurant_id,
      r.name,
      COUNT(o.id)::integer AS orders,
      COALESCE(SUM(o.total), 0)::numeric AS revenue
    FROM public.restaurants r
    LEFT JOIN public.orders o
      ON o.restaurant_id = r.id
     AND o.status <> 'cancelled'
    WHERE r.group_id = p_group_id
      AND r.is_branch = true
      AND (p_restaurant_id IS NULL OR r.id = p_restaurant_id)
    GROUP BY r.id, r.name
    ORDER BY COALESCE(SUM(o.total), 0) DESC, COUNT(o.id) DESC
  ) AS rows;

  SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)
  INTO v_daily_trend
  FROM (
    SELECT
      to_char(date_trunc('day', o.created_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::integer AS orders,
      COALESCE(SUM(o.total), 0)::numeric AS revenue
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE r.group_id = p_group_id
      AND r.is_branch = true
      AND o.status <> 'cancelled'
      AND o.created_at >= date_trunc('day', now()) - interval '13 days'
      AND (p_restaurant_id IS NULL OR o.restaurant_id = p_restaurant_id)
    GROUP BY date_trunc('day', o.created_at)
    ORDER BY date_trunc('day', o.created_at)
  ) AS rows;

  SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)
  INTO v_category_breakdown
  FROM (
    SELECT
      COALESCE(mi.category, 'Uncategorized') AS category,
      SUM(oi.quantity)::integer AS quantity,
      SUM(oi.quantity * oi.price)::numeric AS revenue
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
    WHERE r.group_id = p_group_id
      AND r.is_branch = true
      AND o.status <> 'cancelled'
      AND (p_restaurant_id IS NULL OR o.restaurant_id = p_restaurant_id)
    GROUP BY COALESCE(mi.category, 'Uncategorized')
    ORDER BY SUM(oi.quantity * oi.price) DESC
  ) AS rows;

  RETURN jsonb_build_object(
    'total_revenue', COALESCE(v_total_revenue, 0),
    'total_orders', COALESCE(v_total_orders, 0),
    'avg_order_value', COALESCE(v_avg_order_value, 0),
    'restaurant_breakdown', v_restaurant_breakdown,
    'daily_trend', v_daily_trend,
    'category_breakdown', v_category_breakdown
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_enterprise_analytics(uuid, uuid) TO authenticated;
