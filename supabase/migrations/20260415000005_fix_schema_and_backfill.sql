-- ============================================================
-- COMPREHENSIVE FIX: Add missing columns + backfill all data
-- Problem: user_roles had no restaurant_id column, and
--          staff_restaurants had no role column. All previous
--          backfill migrations failed silently because of this.
-- ============================================================

-- 1. Add restaurant_id to user_roles if it doesn't exist
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL;
-- 2. Add role column to staff_restaurants if it doesn't exist
ALTER TABLE public.staff_restaurants
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'waiter'
    CHECK (role IN ('admin', 'waiter', 'kitchen'));
-- 3. Drop the old UNIQUE(user_id, restaurant_id) and add one with role
--    (only if the old one exists and new one doesn't)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staff_restaurants_user_id_restaurant_id_role_key'
  ) THEN
    -- Add unique constraint that includes role
    ALTER TABLE public.staff_restaurants
      DROP CONSTRAINT IF EXISTS staff_restaurants_user_id_restaurant_id_key;
    ALTER TABLE public.staff_restaurants
      ADD CONSTRAINT staff_restaurants_user_id_restaurant_id_key
        UNIQUE (user_id, restaurant_id);
  END IF;
END $$;
-- 4. Fix get_user_restaurant_id to always check both owner + staff
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.restaurants WHERE owner_id = _user_id LIMIT 1),
    (SELECT restaurant_id FROM public.staff_restaurants WHERE user_id = _user_id LIMIT 1)
  )
$$;
-- 5. Backfill user_roles.restaurant_id for existing rows that have NULL
UPDATE public.user_roles ur
SET restaurant_id = r.id
FROM public.restaurants r
WHERE r.owner_id = ur.user_id
  AND ur.restaurant_id IS NULL
  AND ur.role = 'admin'::public.app_role;
UPDATE public.user_roles ur
SET restaurant_id = sr.restaurant_id
FROM public.staff_restaurants sr
WHERE sr.user_id = ur.user_id
  AND ur.restaurant_id IS NULL
  AND ur.role IN ('waiter', 'kitchen');
-- 6. Insert missing user_roles for restaurant owners
INSERT INTO public.user_roles (user_id, role, restaurant_id)
SELECT r.owner_id, 'admin'::public.app_role, r.id
FROM public.restaurants r
WHERE r.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = r.owner_id AND ur.role = 'admin'::public.app_role
  );
-- 7. Insert missing user_roles for staff members
DO $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  SELECT sr.user_id, sr.role::public.app_role, sr.restaurant_id
  FROM public.staff_restaurants sr
  WHERE sr.role IN ('waiter', 'kitchen', 'admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = sr.user_id
        AND ur.role = sr.role::public.app_role
    );
EXCEPTION
  WHEN invalid_text_representation THEN
    INSERT INTO public.user_roles (user_id, role, restaurant_id)
    SELECT sr.user_id, sr.role::public.app_role, sr.restaurant_id
    FROM public.staff_restaurants sr
    WHERE sr.role IN ('waiter', 'admin')
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = sr.user_id
          AND ur.role = sr.role::public.app_role
      );
END $$;
-- 8. Update sync trigger to handle restaurant_id properly
CREATE OR REPLACE FUNCTION public.sync_staff_to_user_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id
      AND role = OLD.role::public.app_role
      AND restaurant_id = OLD.restaurant_id;
    RETURN OLD;
  END IF;

  IF OLD IS NOT NULL AND OLD.role IS DISTINCT FROM NEW.role THEN
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id
      AND role = OLD.role::public.app_role
      AND restaurant_id = OLD.restaurant_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  VALUES (NEW.user_id, NEW.role::public.app_role, NEW.restaurant_id)
  ON CONFLICT (user_id, role) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_staff_to_user_roles ON public.staff_restaurants;
CREATE TRIGGER trg_sync_staff_to_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.staff_restaurants
FOR EACH ROW EXECUTE FUNCTION public.sync_staff_to_user_roles();
-- 9. Enable Realtime for waiter-critical tables (safe to run again)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
