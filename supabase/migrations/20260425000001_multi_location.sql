-- disable_ddl_transaction

-- ============================================================
-- Phase 1: Multi-Location / Restaurant Chain Support
-- ============================================================

-- 1. Add group_owner to app_role enum (must run outside transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'group_owner';
-- ============================================================
-- 2. restaurant_groups table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.restaurant_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  owner_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  logo_url    text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_restaurant_groups_updated_at
  BEFORE UPDATE ON public.restaurant_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ============================================================
-- 3. Add group columns to restaurants
-- ============================================================
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS group_id    uuid REFERENCES public.restaurant_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_branch   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS branch_code text;
CREATE INDEX IF NOT EXISTS idx_restaurants_group_id ON public.restaurants(group_id);
-- ============================================================
-- 4. group_shared_menus table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_shared_menus (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES public.restaurant_groups(id) ON DELETE CASCADE,
  name        text NOT NULL,
  category    text NOT NULL DEFAULT 'সাধারণ',
  description text,
  price       numeric(10,2) NOT NULL DEFAULT 0,
  image_url   text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_shared_menus_group_id ON public.group_shared_menus(group_id);
CREATE OR REPLACE TRIGGER trg_group_shared_menus_updated_at
  BEFORE UPDATE ON public.group_shared_menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ============================================================
-- 5. branch_menu_overrides table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.branch_menu_overrides (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  shared_menu_item_id  uuid NOT NULL REFERENCES public.group_shared_menus(id) ON DELETE CASCADE,
  custom_price         numeric(10,2),
  is_available         boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, shared_menu_item_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_overrides_restaurant ON public.branch_menu_overrides(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_branch_overrides_shared_item ON public.branch_menu_overrides(shared_menu_item_id);
-- ============================================================
-- 6. Row Level Security
-- ============================================================
ALTER TABLE public.restaurant_groups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_shared_menus  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_menu_overrides ENABLE ROW LEVEL SECURITY;
-- Helper: is current user group_owner of this group?
CREATE OR REPLACE FUNCTION public.is_group_owner(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_groups
    WHERE id = p_group_id AND owner_id = auth.uid()
  );
$$;
-- restaurant_groups policies
DROP POLICY IF EXISTS "group_owner_select"  ON public.restaurant_groups;
DROP POLICY IF EXISTS "group_owner_insert"  ON public.restaurant_groups;
DROP POLICY IF EXISTS "group_owner_update"  ON public.restaurant_groups;
DROP POLICY IF EXISTS "group_owner_delete"  ON public.restaurant_groups;
DROP POLICY IF EXISTS "super_admin_groups"  ON public.restaurant_groups;
CREATE POLICY "group_owner_select" ON public.restaurant_groups
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  ));
CREATE POLICY "group_owner_insert" ON public.restaurant_groups
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "group_owner_update" ON public.restaurant_groups
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "group_owner_delete" ON public.restaurant_groups
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
-- group_shared_menus policies
DROP POLICY IF EXISTS "shared_menu_select" ON public.group_shared_menus;
DROP POLICY IF EXISTS "shared_menu_insert" ON public.group_shared_menus;
DROP POLICY IF EXISTS "shared_menu_update" ON public.group_shared_menus;
DROP POLICY IF EXISTS "shared_menu_delete" ON public.group_shared_menus;
CREATE POLICY "shared_menu_select" ON public.group_shared_menus
  FOR SELECT TO authenticated
  USING (public.is_group_owner(group_id) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  ));
CREATE POLICY "shared_menu_insert" ON public.group_shared_menus
  FOR INSERT TO authenticated
  WITH CHECK (public.is_group_owner(group_id));
CREATE POLICY "shared_menu_update" ON public.group_shared_menus
  FOR UPDATE TO authenticated
  USING (public.is_group_owner(group_id))
  WITH CHECK (public.is_group_owner(group_id));
CREATE POLICY "shared_menu_delete" ON public.group_shared_menus
  FOR DELETE TO authenticated
  USING (public.is_group_owner(group_id));
-- branch_menu_overrides policies
DROP POLICY IF EXISTS "branch_override_select" ON public.branch_menu_overrides;
DROP POLICY IF EXISTS "branch_override_insert" ON public.branch_menu_overrides;
DROP POLICY IF EXISTS "branch_override_update" ON public.branch_menu_overrides;
DROP POLICY IF EXISTS "branch_override_delete" ON public.branch_menu_overrides;
CREATE POLICY "branch_override_select" ON public.branch_menu_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      JOIN public.restaurant_groups g ON g.id = r.group_id
      WHERE r.id = restaurant_id AND g.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );
CREATE POLICY "branch_override_insert" ON public.branch_menu_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      JOIN public.restaurant_groups g ON g.id = r.group_id
      WHERE r.id = restaurant_id AND g.owner_id = auth.uid()
    )
  );
CREATE POLICY "branch_override_update" ON public.branch_menu_overrides
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      JOIN public.restaurant_groups g ON g.id = r.group_id
      WHERE r.id = restaurant_id AND g.owner_id = auth.uid()
    )
  );
CREATE POLICY "branch_override_delete" ON public.branch_menu_overrides
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      JOIN public.restaurant_groups g ON g.id = r.group_id
      WHERE r.id = restaurant_id AND g.owner_id = auth.uid()
    )
  );
-- ============================================================
-- 7. RPC: get_group_analytics
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_group_analytics(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result   jsonb;
  v_branches jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_groups WHERE id = p_group_id AND owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'restaurant_id',   r.id,
      'name',            r.name,
      'branch_code',     COALESCE(r.branch_code, ''),
      'revenue',         COALESCE(stats.revenue, 0),
      'orders',          COALESCE(stats.orders, 0),
      'avg_order_value', COALESCE(stats.avg_order_value, 0)
    ) ORDER BY COALESCE(stats.revenue, 0) DESC
  )
  INTO v_branches
  FROM public.restaurants r
  LEFT JOIN (
    SELECT
      restaurant_id,
      SUM(total)::numeric(12,2)  AS revenue,
      COUNT(*)                    AS orders,
      AVG(total)::numeric(10,2)   AS avg_order_value
    FROM public.orders
    WHERE created_at >= CURRENT_DATE
      AND status NOT IN ('cancelled')
    GROUP BY restaurant_id
  ) stats ON stats.restaurant_id = r.id
  WHERE r.group_id = p_group_id;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(o.total), 0)::numeric(12,2),
    'total_orders',  COUNT(o.id),
    'per_branch',    COALESCE(v_branches, '[]'::jsonb)
  )
  INTO v_result
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.group_id = p_group_id
    AND o.created_at >= CURRENT_DATE
    AND o.status NOT IN ('cancelled');

  RETURN COALESCE(v_result, jsonb_build_object(
    'total_revenue', 0,
    'total_orders',  0,
    'per_branch',    COALESCE(v_branches, '[]'::jsonb)
  ));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_group_analytics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid) TO authenticated;
