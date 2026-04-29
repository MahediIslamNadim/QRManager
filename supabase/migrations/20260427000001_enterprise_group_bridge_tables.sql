-- Enterprise group bridge tables, notices, audit trail, and compatibility RPCs.
-- This keeps the existing restaurants.group_id/is_branch model working while
-- adding an explicit enterprise membership layer for safer multi-location access.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS subscription_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_end_date timestamptz;
DO $$
BEGIN
  ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_plan_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_plan_check
  CHECK (plan IN ('basic', 'premium', 'enterprise', 'medium_smart', 'high_smart', 'high_smart_enterprise'));
CREATE TABLE IF NOT EXISTS public.group_restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.restaurant_groups(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  is_head_office boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, restaurant_id),
  UNIQUE (restaurant_id)
);
CREATE TABLE IF NOT EXISTS public.group_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.restaurant_groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'selected')),
  send_email boolean NOT NULL DEFAULT false,
  source_enterprise_notice_id uuid REFERENCES public.enterprise_notices(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_notices_source_enterprise_notice_id
  ON public.group_notices (source_enterprise_notice_id)
  WHERE source_enterprise_notice_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.group_notice_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.group_notices(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  delivery_status text NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'in_app', 'delivered', 'partial', 'failed')),
  delivered_in_app_at timestamptz,
  delivered_email_at timestamptz,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notice_id, restaurant_id)
);
CREATE TABLE IF NOT EXISTS public.group_admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.restaurant_groups(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_restaurants_group_id
  ON public.group_restaurants (group_id, status, is_head_office);
CREATE INDEX IF NOT EXISTS idx_group_restaurants_restaurant_id
  ON public.group_restaurants (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_group_notices_group_id
  ON public.group_notices (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_notice_targets_notice_id
  ON public.group_notice_targets (notice_id);
CREATE INDEX IF NOT EXISTS idx_group_notice_targets_restaurant_id
  ON public.group_notice_targets (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_group_admin_actions_group_id
  ON public.group_admin_actions (group_id, created_at DESC);
ALTER TABLE public.group_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_notice_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_admin_actions ENABLE ROW LEVEL SECURITY;
INSERT INTO public.group_restaurants (
  group_id,
  restaurant_id,
  is_head_office,
  status,
  linked_by,
  linked_at,
  created_at,
  updated_at
)
SELECT
  r.group_id,
  r.id,
  COALESCE(r.is_branch, false) = false,
  CASE WHEN r.status IN ('active', 'active_paid') THEN 'active' ELSE 'inactive' END,
  r.owner_id,
  COALESCE(r.created_at, now()),
  COALESCE(r.created_at, now()),
  COALESCE(r.updated_at, now())
FROM public.restaurants r
WHERE r.group_id IS NOT NULL
ON CONFLICT (restaurant_id)
DO UPDATE SET
  group_id = EXCLUDED.group_id,
  is_head_office = EXCLUDED.is_head_office,
  status = EXCLUDED.status,
  updated_at = now();
CREATE OR REPLACE FUNCTION public.sync_group_restaurant_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.group_id IS NULL THEN
    DELETE FROM public.group_restaurants
    WHERE restaurant_id = NEW.id;
    RETURN NEW;
  END IF;

  v_status := CASE
    WHEN NEW.status IN ('active', 'active_paid') THEN 'active'
    ELSE 'inactive'
  END;

  INSERT INTO public.group_restaurants (
    group_id,
    restaurant_id,
    is_head_office,
    status,
    linked_by
  )
  VALUES (
    NEW.group_id,
    NEW.id,
    COALESCE(NEW.is_branch, false) = false,
    v_status,
    auth.uid()
  )
  ON CONFLICT (restaurant_id)
  DO UPDATE SET
    group_id = EXCLUDED.group_id,
    is_head_office = EXCLUDED.is_head_office,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_group_restaurant_membership ON public.restaurants;
CREATE TRIGGER trg_sync_group_restaurant_membership
AFTER INSERT OR UPDATE OF group_id, is_branch, status ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.sync_group_restaurant_membership();
DROP POLICY IF EXISTS "group_restaurants_enterprise_managers_manage" ON public.group_restaurants;
DROP POLICY IF EXISTS "group_restaurants_restaurant_admins_view_own" ON public.group_restaurants;
DROP POLICY IF EXISTS "group_notices_enterprise_managers_manage" ON public.group_notices;
DROP POLICY IF EXISTS "group_notice_targets_enterprise_managers_manage" ON public.group_notice_targets;
DROP POLICY IF EXISTS "group_notice_targets_restaurant_admins_view_own" ON public.group_notice_targets;
DROP POLICY IF EXISTS "group_admin_actions_enterprise_managers_view" ON public.group_admin_actions;
DROP POLICY IF EXISTS "group_admin_actions_enterprise_managers_insert" ON public.group_admin_actions;
CREATE POLICY "group_restaurants_enterprise_managers_manage"
ON public.group_restaurants
FOR ALL
TO authenticated
USING (public.can_manage_enterprise_group(group_id))
WITH CHECK (public.can_manage_enterprise_group(group_id));
CREATE POLICY "group_restaurants_restaurant_admins_view_own"
ON public.group_restaurants
FOR SELECT
TO authenticated
USING (public.is_restaurant_admin(auth.uid(), restaurant_id));
CREATE POLICY "group_notices_enterprise_managers_manage"
ON public.group_notices
FOR ALL
TO authenticated
USING (public.can_manage_enterprise_group(group_id))
WITH CHECK (public.can_manage_enterprise_group(group_id));
CREATE POLICY "group_notice_targets_enterprise_managers_manage"
ON public.group_notice_targets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.group_notices n
    WHERE n.id = group_notice_targets.notice_id
      AND public.can_manage_enterprise_group(n.group_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.group_notices n
    WHERE n.id = group_notice_targets.notice_id
      AND public.can_manage_enterprise_group(n.group_id)
  )
);
CREATE POLICY "group_notice_targets_restaurant_admins_view_own"
ON public.group_notice_targets
FOR SELECT
TO authenticated
USING (public.is_restaurant_admin(auth.uid(), restaurant_id));
CREATE POLICY "group_admin_actions_enterprise_managers_view"
ON public.group_admin_actions
FOR SELECT
TO authenticated
USING (public.can_manage_enterprise_group(group_id));
CREATE POLICY "group_admin_actions_enterprise_managers_insert"
ON public.group_admin_actions
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_enterprise_group(group_id));
CREATE OR REPLACE FUNCTION public.get_user_groups(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  id uuid,
  name text,
  owner_id uuid,
  logo_url text,
  description text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  IF public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN QUERY
    SELECT g.id, g.name, g.owner_id, g.logo_url, g.description, g.created_at, g.updated_at
    FROM public.restaurant_groups g
    ORDER BY g.created_at DESC;
    RETURN;
  END IF;

  IF _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT g.id, g.name, g.owner_id, g.logo_url, g.description, g.created_at, g.updated_at
  FROM public.restaurant_groups g
  WHERE g.owner_id = _user_id
    AND public.can_manage_enterprise_group(g.id, _user_id)
  ORDER BY g.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_groups(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_group_restaurants(p_group_id uuid)
RETURNS TABLE (
  group_restaurant_id uuid,
  restaurant_id uuid,
  name text,
  address text,
  phone text,
  status text,
  branch_code text,
  is_head_office boolean,
  link_status text,
  owner_id uuid,
  created_at timestamptz,
  updated_at timestamptz
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
    gr.id,
    r.id,
    r.name,
    r.address,
    r.phone,
    r.status,
    r.branch_code,
    gr.is_head_office,
    gr.status,
    r.owner_id,
    r.created_at,
    r.updated_at
  FROM public.group_restaurants gr
  JOIN public.restaurants r ON r.id = gr.restaurant_id
  WHERE gr.group_id = p_group_id
    AND gr.is_head_office = false
  ORDER BY r.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_group_restaurants(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_enterprise_restaurant(
  p_group_id uuid,
  p_restaurant_name text,
  p_admin_user_id uuid,
  p_admin_full_name text DEFAULT null,
  p_admin_email text DEFAULT null,
  p_admin_phone text DEFAULT null,
  p_restaurant_address text DEFAULT null,
  p_restaurant_phone text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_head_office public.restaurants%ROWTYPE;
  v_restaurant_id uuid;
  v_expiry timestamptz;
BEGIN
  IF NOT public.can_manage_enterprise_group(p_group_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user is required';
  END IF;

  IF NULLIF(btrim(p_restaurant_name), '') IS NULL THEN
    RAISE EXCEPTION 'Restaurant name is required';
  END IF;

  SELECT *
  INTO v_head_office
  FROM public.restaurants
  WHERE group_id = p_group_id
    AND is_branch = false
    AND COALESCE(tier, plan) = 'high_smart_enterprise'
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enterprise head office is not ready';
  END IF;

  v_expiry := COALESCE(
    v_head_office.subscription_end_date,
    v_head_office.trial_end_date,
    now() + interval '1 year'
  );

  INSERT INTO public.restaurants (
    name,
    address,
    phone,
    owner_id,
    status,
    group_id,
    is_branch,
    plan,
    tier,
    billing_cycle,
    subscription_status,
    subscription_start_date,
    subscription_end_date,
    trial_end_date,
    trial_ends_at
  )
  VALUES (
    btrim(p_restaurant_name),
    NULLIF(btrim(COALESCE(p_restaurant_address, '')), ''),
    NULLIF(btrim(COALESCE(p_restaurant_phone, '')), ''),
    p_admin_user_id,
    'active',
    p_group_id,
    true,
    'high_smart_enterprise',
    'high_smart_enterprise',
    COALESCE(v_head_office.billing_cycle, 'yearly'),
    'active',
    now(),
    v_expiry,
    v_expiry,
    v_expiry
  )
  RETURNING id INTO v_restaurant_id;

  INSERT INTO public.profiles (id, full_name, email, phone, restaurant_id)
  VALUES (
    p_admin_user_id,
    NULLIF(btrim(COALESCE(p_admin_full_name, '')), ''),
    NULLIF(btrim(COALESCE(p_admin_email, '')), ''),
    NULLIF(btrim(COALESCE(p_admin_phone, '')), ''),
    v_restaurant_id
  )
  ON CONFLICT (id)
  DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    restaurant_id = EXCLUDED.restaurant_id,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  VALUES (p_admin_user_id, 'admin'::public.app_role, v_restaurant_id)
  ON CONFLICT (user_id, role)
  DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id;

  INSERT INTO public.staff_restaurants (user_id, restaurant_id, role)
  VALUES (p_admin_user_id, v_restaurant_id, 'admin')
  ON CONFLICT (user_id, restaurant_id)
  DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.group_restaurants (group_id, restaurant_id, is_head_office, status, linked_by)
  VALUES (p_group_id, v_restaurant_id, false, 'active', auth.uid())
  ON CONFLICT (restaurant_id)
  DO UPDATE SET
    group_id = EXCLUDED.group_id,
    is_head_office = EXCLUDED.is_head_office,
    status = EXCLUDED.status,
    updated_at = now();

  INSERT INTO public.group_admin_actions (group_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_group_id,
    auth.uid(),
    'create_restaurant',
    'restaurant',
    v_restaurant_id,
    jsonb_build_object('restaurant_name', p_restaurant_name, 'admin_user_id', p_admin_user_id)
  );

  RETURN v_restaurant_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_enterprise_restaurant(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text
) TO authenticated;
CREATE OR REPLACE FUNCTION public.send_group_notice(
  p_group_id uuid,
  p_title text,
  p_message text,
  p_target_mode text DEFAULT 'all',
  p_restaurant_ids uuid[] DEFAULT null,
  p_send_email boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notice_id uuid;
  v_target_count integer := 0;
  v_notification_count integer := 0;
BEGIN
  IF NOT public.can_manage_enterprise_group(p_group_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF NULLIF(btrim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Notice title is required';
  END IF;

  IF NULLIF(btrim(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'Notice message is required';
  END IF;

  IF p_target_mode NOT IN ('all', 'selected') THEN
    RAISE EXCEPTION 'Invalid notice target mode';
  END IF;

  IF p_target_mode = 'selected' AND COALESCE(array_length(p_restaurant_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one restaurant';
  END IF;

  INSERT INTO public.group_notices (
    group_id,
    title,
    message,
    audience,
    send_email,
    created_by
  )
  VALUES (
    p_group_id,
    btrim(p_title),
    btrim(p_message),
    p_target_mode,
    p_send_email,
    auth.uid()
  )
  RETURNING id INTO v_notice_id;

  WITH target_restaurants AS (
    SELECT DISTINCT gr.restaurant_id
    FROM public.group_restaurants gr
    JOIN public.restaurants r ON r.id = gr.restaurant_id
    WHERE gr.group_id = p_group_id
      AND gr.is_head_office = false
      AND gr.status = 'active'
      AND r.is_branch = true
      AND (p_target_mode = 'all' OR gr.restaurant_id = ANY(COALESCE(p_restaurant_ids, ARRAY[]::uuid[])))
  )
  INSERT INTO public.group_notice_targets (notice_id, restaurant_id)
  SELECT v_notice_id, restaurant_id
  FROM target_restaurants;

  GET DIAGNOSTICS v_target_count = ROW_COUNT;

  IF v_target_count = 0 THEN
    DELETE FROM public.group_notices WHERE id = v_notice_id;
    RAISE EXCEPTION 'No target restaurants found';
  END IF;

  WITH target_admins AS (
    SELECT DISTINCT sr.user_id, gt.restaurant_id
    FROM public.group_notice_targets gt
    JOIN public.staff_restaurants sr
      ON sr.restaurant_id = gt.restaurant_id
     AND sr.role = 'admin'
    WHERE gt.notice_id = v_notice_id
  )
  INSERT INTO public.notifications (user_id, restaurant_id, title, message, type)
  SELECT user_id, restaurant_id, btrim(p_title), btrim(p_message), 'announcement'
  FROM target_admins;

  GET DIAGNOSTICS v_notification_count = ROW_COUNT;

  UPDATE public.group_notice_targets
  SET
    delivery_status = 'in_app',
    delivered_in_app_at = now()
  WHERE notice_id = v_notice_id;

  INSERT INTO public.group_admin_actions (group_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_group_id,
    auth.uid(),
    'send_notice',
    'group_notice',
    v_notice_id,
    jsonb_build_object(
      'target_mode', p_target_mode,
      'target_count', v_target_count,
      'notification_count', v_notification_count,
      'send_email', p_send_email
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'notice_id', v_notice_id,
    'target_count', v_target_count,
    'notification_count', v_notification_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_group_notice(uuid, text, text, text, uuid[], boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_group_analytics(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_branches jsonb;
BEGIN
  IF NOT public.can_manage_enterprise_group(p_group_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  WITH branch_stats AS (
    SELECT
      r.id AS restaurant_id,
      r.name,
      r.branch_code,
      COALESCE(SUM(o.total), 0)::numeric(12, 2) AS revenue,
      COUNT(o.id)::integer AS orders,
      CASE
        WHEN COUNT(o.id) > 0 THEN (COALESCE(SUM(o.total), 0) / COUNT(o.id))::numeric(10, 2)
        ELSE 0::numeric(10, 2)
      END AS avg_order_value
    FROM public.group_restaurants gr
    JOIN public.restaurants r ON r.id = gr.restaurant_id
    LEFT JOIN public.orders o
      ON o.restaurant_id = r.id
     AND o.status <> 'cancelled'
     AND o.created_at >= CURRENT_DATE
    WHERE gr.group_id = p_group_id
      AND gr.is_head_office = false
      AND gr.status = 'active'
      AND r.is_branch = true
    GROUP BY r.id, r.name, r.branch_code
    ORDER BY revenue DESC, orders DESC, r.name
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(branch_stats)), '[]'::jsonb)
  INTO v_branches
  FROM branch_stats;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(o.total), 0)::numeric(12, 2),
    'total_orders', COUNT(o.id)::integer,
    'per_branch', COALESCE(v_branches, '[]'::jsonb)
  )
  INTO v_result
  FROM public.group_restaurants gr
  JOIN public.restaurants r ON r.id = gr.restaurant_id
  LEFT JOIN public.orders o
    ON o.restaurant_id = r.id
   AND o.status <> 'cancelled'
   AND o.created_at >= CURRENT_DATE
  WHERE gr.group_id = p_group_id
    AND gr.is_head_office = false
    AND gr.status = 'active'
    AND r.is_branch = true;

  RETURN COALESCE(v_result, jsonb_build_object(
    'total_revenue', 0,
    'total_orders', 0,
    'per_branch', COALESCE(v_branches, '[]'::jsonb)
  ));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_group_analytics(uuid) TO authenticated;
