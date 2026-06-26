-- =============================================================================
-- Fix: restaurant status mismatch between signup and public access policies
-- =============================================================================
-- Problem:
--   complete_admin_signup() creates restaurants with status = 'trial',
--   but the anon RLS policy and all public-facing SECURITY DEFINER RPCs
--   only check for status = 'active'. This means QR code scanning fails
--   with "রেস্টুরেন্ট পাওয়া যায়নি" for newly created trial restaurants.
--
-- Fix:
--   1. RLS: allow anon to see restaurants with status IN ('trial','active','active_paid')
--   2. get_public_table_context(): check status IN ('trial','active','active_paid')
--   3. create_public_review(): check status IN ('trial','active','active_paid')
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS: Drop old policies, recreate with wider status check
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anon can view active restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Anyone can view active restaurants" ON public.restaurants;

CREATE POLICY "Anyone can view active restaurants"
ON public.restaurants FOR SELECT
TO authenticated
USING (
  (status IN ('trial', 'active', 'active_paid'))
  OR (owner_id = auth.uid())
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Anon can view active restaurants"
ON public.restaurants FOR SELECT
TO anon
USING (status IN ('trial', 'active', 'active_paid'));

-- ---------------------------------------------------------------------------
-- 2. get_public_table_context: allow trial restaurants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_table_context(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_token uuid,
  p_seat_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant jsonb;
  v_table jsonb;
  v_seat_number integer;
BEGIN
  IF p_token IS NULL
     OR NOT public.has_valid_customer_session(p_restaurant_id, p_table_id, p_token, p_seat_id) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'id', r.id,
           'name', r.name
         )
  INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id
    AND r.status IN ('trial', 'active', 'active_paid');

  IF v_restaurant IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'id', t.id,
           'name', t.name,
           'is_open', COALESCE(t.is_open, true),
           'has_seats', EXISTS (
             SELECT 1
             FROM public.table_seats ts
             WHERE ts.table_id = t.id
           )
         )
  INTO v_table
  FROM public.restaurant_tables t
  WHERE t.id = p_table_id
    AND t.restaurant_id = p_restaurant_id;

  IF v_table IS NULL OR COALESCE((v_table ->> 'is_open')::boolean, true) = false THEN
    RETURN NULL;
  END IF;

  IF p_seat_id IS NOT NULL THEN
    SELECT ts.seat_number
    INTO v_seat_number
    FROM public.table_seats ts
    WHERE ts.id = p_seat_id
      AND ts.table_id = p_table_id;
  END IF;

  RETURN jsonb_build_object(
    'restaurant', v_restaurant,
    'table', v_table,
    'seat_number', v_seat_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_table_context(uuid, uuid, uuid, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. create_public_review: allow trial restaurants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_public_review(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_token uuid,
  p_rating smallint,
  p_menu_item_id uuid DEFAULT NULL,
  p_comment text DEFAULT NULL,
  p_seat_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_id uuid;
BEGIN
  IF p_token IS NULL
     OR NOT public.has_valid_customer_session(p_restaurant_id, p_table_id, p_token, p_seat_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Invalid rating';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = p_restaurant_id
      AND r.status IN ('trial', 'active', 'active_paid')
  ) THEN
    RAISE EXCEPTION 'Restaurant not available';
  END IF;

  IF p_menu_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.id = p_menu_item_id
      AND mi.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Menu item not found';
  END IF;

  INSERT INTO public.reviews (
    restaurant_id,
    menu_item_id,
    rating,
    comment
  )
  VALUES (
    p_restaurant_id,
    p_menu_item_id,
    p_rating,
    CASE
      WHEN p_comment IS NULL OR btrim(p_comment) = '' THEN NULL
      ELSE LEFT(btrim(p_comment), 500)
    END
  )
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_review(uuid, uuid, uuid, smallint, uuid, text, uuid) TO anon, authenticated;
