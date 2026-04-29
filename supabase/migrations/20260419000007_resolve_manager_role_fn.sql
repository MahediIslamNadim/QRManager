-- SECURITY DEFINER function to resolve/backfill dedicated_manager role at login time.
-- Handles three cases:
--  1. user_roles row already exists → return immediately
--  2. dedicated_managers.user_id matches → backfill user_roles
--  3. dedicated_managers.email matches auth.users.email → backfill both
CREATE OR REPLACE FUNCTION public.resolve_manager_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_email    text;
  v_mgr_id   uuid;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  -- 1. Already has the role row
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND role = 'dedicated_manager'::public.app_role
  ) THEN
    RETURN 'dedicated_manager';
  END IF;

  -- 2. dedicated_managers.user_id points to this user
  SELECT id INTO v_mgr_id FROM public.dedicated_managers WHERE user_id = v_user_id LIMIT 1;
  IF v_mgr_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'dedicated_manager'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN 'dedicated_manager';
  END IF;

  -- 3. Email match in auth.users → dedicated_managers.email
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id LIMIT 1;
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_mgr_id
    FROM public.dedicated_managers
    WHERE LOWER(email) = LOWER(v_email) AND is_active = true
    LIMIT 1;

    IF v_mgr_id IS NOT NULL THEN
      UPDATE public.dedicated_managers SET user_id = v_user_id WHERE id = v_mgr_id;
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'dedicated_manager'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
      RETURN 'dedicated_manager';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_manager_role() TO authenticated;
