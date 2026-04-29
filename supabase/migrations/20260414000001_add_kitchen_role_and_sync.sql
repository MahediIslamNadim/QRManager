-- 1. Add 'kitchen' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'kitchen';
-- 2. Backfill: for any staff_restaurants rows with role='kitchen' that have no
--    matching user_roles row, insert the missing row.
INSERT INTO public.user_roles (user_id, role, restaurant_id)
SELECT
  sr.user_id,
  sr.role::public.app_role,
  sr.restaurant_id
FROM public.staff_restaurants sr
WHERE sr.role IN ('admin', 'waiter', 'kitchen')
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = sr.user_id
      AND ur.role = sr.role::public.app_role
  );
-- 3. Trigger: keep user_roles in sync whenever a staff_restaurants row is
--    inserted or updated (role change).
CREATE OR REPLACE FUNCTION public.sync_staff_to_user_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Remove from user_roles when staff membership is removed
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id
      AND role = OLD.role::public.app_role
      AND restaurant_id = OLD.restaurant_id;
    RETURN OLD;
  END IF;

  -- On INSERT or UPDATE: upsert the role row
  IF OLD IS NOT NULL AND OLD.role IS DISTINCT FROM NEW.role THEN
    -- Role changed: remove the old role row
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id
      AND role = OLD.role::public.app_role
      AND restaurant_id = OLD.restaurant_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role, restaurant_id)
  VALUES (NEW.user_id, NEW.role::public.app_role, NEW.restaurant_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_staff_to_user_roles ON public.staff_restaurants;
CREATE TRIGGER trg_sync_staff_to_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.staff_restaurants
FOR EACH ROW EXECUTE FUNCTION public.sync_staff_to_user_roles();
