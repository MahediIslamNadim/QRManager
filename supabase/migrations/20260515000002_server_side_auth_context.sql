-- Resolve authenticated app context server-side so the frontend no longer
-- needs to query user_roles/staff_restaurants/restaurants directly at login.
DROP FUNCTION IF EXISTS public.get_auth_context();

CREATE OR REPLACE FUNCTION public.get_auth_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role public.app_role;
  v_restaurant_id UUID;
  v_plan TEXT := 'basic';
  v_subscription_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
  v_trial_expired BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT ur.role, ur.restaurant_id
  INTO v_role, v_restaurant_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
    AND ur.role IN (
      'super_admin'::public.app_role,
      'admin'::public.app_role,
      'waiter'::public.app_role,
      'kitchen'::public.app_role
    )
  ORDER BY CASE ur.role
    WHEN 'super_admin'::public.app_role THEN 1
    WHEN 'admin'::public.app_role THEN 2
    WHEN 'waiter'::public.app_role THEN 3
    WHEN 'kitchen'::public.app_role THEN 4
    ELSE 99
  END
  LIMIT 1;

  IF v_role IS NULL THEN
    SELECT r.id
    INTO v_restaurant_id
    FROM public.restaurants r
    WHERE r.owner_id = v_user_id
    ORDER BY r.created_at
    LIMIT 1;

    IF v_restaurant_id IS NOT NULL THEN
      v_role := 'admin'::public.app_role;

      INSERT INTO public.user_roles (user_id, role, restaurant_id)
      VALUES (v_user_id, v_role, v_restaurant_id)
      ON CONFLICT (user_id, role) DO UPDATE
      SET restaurant_id = EXCLUDED.restaurant_id;
    ELSE
      SELECT sr.role::public.app_role, sr.restaurant_id
      INTO v_role, v_restaurant_id
      FROM public.staff_restaurants sr
      WHERE sr.user_id = v_user_id
        AND sr.role IN ('admin', 'waiter', 'kitchen')
      ORDER BY CASE sr.role
        WHEN 'admin' THEN 1
        WHEN 'waiter' THEN 2
        WHEN 'kitchen' THEN 3
        ELSE 99
      END
      LIMIT 1;

      IF v_role IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role, restaurant_id)
        VALUES (v_user_id, v_role, v_restaurant_id)
        ON CONFLICT (user_id, role) DO UPDATE
        SET restaurant_id = COALESCE(EXCLUDED.restaurant_id, public.user_roles.restaurant_id);
      END IF;
    END IF;
  ELSIF v_role IN (
    'admin'::public.app_role,
    'waiter'::public.app_role,
    'kitchen'::public.app_role
  ) AND v_restaurant_id IS NULL THEN
    v_restaurant_id := public.get_user_restaurant_id(v_user_id);

    IF v_restaurant_id IS NOT NULL THEN
      UPDATE public.user_roles
      SET restaurant_id = v_restaurant_id
      WHERE user_id = v_user_id
        AND role = v_role
        AND restaurant_id IS DISTINCT FROM v_restaurant_id;
    END IF;
  END IF;

  IF v_restaurant_id IS NOT NULL THEN
    SELECT
      COALESCE(r.tier, r.plan, 'basic'),
      r.subscription_status,
      COALESCE(r.trial_ends_at, r.trial_end_date)
    INTO v_plan, v_subscription_status, v_trial_ends_at
    FROM public.restaurants r
    WHERE r.id = v_restaurant_id
    LIMIT 1;
  END IF;

  IF v_role = 'admin'::public.app_role THEN
    v_trial_expired := COALESCE(v_subscription_status IN ('expired', 'cancelled'), false)
      OR (
        v_trial_ends_at IS NOT NULL
        AND now() > v_trial_ends_at
        AND COALESCE(v_subscription_status, 'trial') <> 'active'
      );
  END IF;

  RETURN jsonb_build_object(
    'role', CASE WHEN v_role IS NULL THEN NULL ELSE v_role::TEXT END,
    'restaurant_id', v_restaurant_id,
    'restaurant_plan', COALESCE(v_plan, 'basic'),
    'trial_expired', v_trial_expired
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_context() TO authenticated;

COMMENT ON FUNCTION public.get_auth_context() IS
'Returns the authenticated user''s app role, restaurant context, plan, and trial state without exposing role resolution queries to the client.';
