-- =============================================================================
-- Lock down public customer-facing tables and replace them with token-gated RPCs
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_valid_customer_session(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_token uuid,
  p_seat_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.table_sessions ts
    WHERE ts.restaurant_id = p_restaurant_id
      AND ts.table_id = p_table_id
      AND ts.token = p_token
      AND ts.expires_at > now()
      AND (
        p_seat_id IS NULL
        OR ts.seat_id IS NULL
        OR ts.seat_id = p_seat_id
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_valid_customer_session(uuid, uuid, uuid, uuid) TO anon, authenticated;

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
    AND r.status = 'active';

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

CREATE OR REPLACE FUNCTION public.get_public_table_seats(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_context jsonb;
  v_seats jsonb;
BEGIN
  v_context := public.get_public_table_context(p_restaurant_id, p_table_id, p_token, NULL);
  IF v_context IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', ts.id,
               'table_id', ts.table_id,
               'seat_number', ts.seat_number,
               'status', ts.status,
               'created_at', ts.created_at
             )
             ORDER BY ts.seat_number
           ),
           '[]'::jsonb
         )
  INTO v_seats
  FROM public.table_seats ts
  WHERE ts.table_id = p_table_id;

  RETURN jsonb_build_object(
    'restaurant', v_context -> 'restaurant',
    'table', v_context -> 'table',
    'seats', v_seats
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_table_seats(uuid, uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_menu_context(
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
  v_context jsonb;
  v_restaurant jsonb;
  v_menu_items jsonb;
  v_ratings jsonb;
BEGIN
  v_context := public.get_public_table_context(p_restaurant_id, p_table_id, p_token, p_seat_id);
  IF v_context IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
           'id', r.id,
           'name', r.name,
           'tier', r.tier,
           'brand_primary', r.brand_primary,
           'brand_secondary', r.brand_secondary,
           'brand_font', r.brand_font,
           'logo_url', r.logo_url
         )
  INTO v_restaurant
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', mi.id,
               'restaurant_id', mi.restaurant_id,
               'name', mi.name,
               'price', mi.price,
               'category', mi.category,
               'description', mi.description,
               'available', mi.available,
               'image_url', mi.image_url,
               'stock_quantity', mi.stock_quantity,
               'prep_time_minutes', mi.prep_time_minutes,
               'sort_order', mi.sort_order,
               'order_count', COALESCE(mim.order_count, 0)
             )
             ORDER BY mi.sort_order NULLS LAST, mi.name
           ),
           '[]'::jsonb
         )
  INTO v_menu_items
  FROM public.menu_items mi
  LEFT JOIN public.menu_item_metrics mim
    ON mim.menu_item_id = mi.id
  WHERE mi.restaurant_id = p_restaurant_id;

  SELECT COALESCE(
           jsonb_object_agg(
             rated.menu_item_id::text,
             jsonb_build_object(
               'avg', rated.avg_rating,
               'count', rated.review_count
             )
           ),
           '{}'::jsonb
         )
  INTO v_ratings
  FROM (
    SELECT
      r.menu_item_id,
      ROUND(AVG(r.rating)::numeric, 1) AS avg_rating,
      COUNT(*)::integer AS review_count
    FROM public.reviews r
    WHERE r.restaurant_id = p_restaurant_id
      AND r.menu_item_id IS NOT NULL
    GROUP BY r.menu_item_id
  ) AS rated;

  RETURN jsonb_build_object(
    'restaurant', v_restaurant,
    'table', v_context -> 'table',
    'seat_number', v_context -> 'seat_number',
    'menu_items', v_menu_items,
    'ratings', v_ratings
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_menu_context(uuid, uuid, uuid, uuid) TO anon, authenticated;

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
      AND r.status = 'active'
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

DROP POLICY IF EXISTS "Anyone can view available menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Anyone can view menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Anyone can view tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Anyone can view seats" ON public.table_seats;
DROP POLICY IF EXISTS "reviews_public_read" ON public.reviews;
DROP POLICY IF EXISTS "reviews_public_insert" ON public.reviews;
DROP POLICY IF EXISTS "Restaurant staff can view restaurant reviews" ON public.reviews;

CREATE POLICY "Restaurant staff can view restaurant reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (
    (
      restaurant_id IS NOT NULL
      AND (
        public.is_restaurant_admin(auth.uid(), restaurant_id)
        OR public.is_restaurant_staff(auth.uid(), restaurant_id)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = reviews.menu_item_id
        AND (
          public.is_restaurant_admin(auth.uid(), mi.restaurant_id)
          OR public.is_restaurant_staff(auth.uid(), mi.restaurant_id)
        )
    )
  );

DO $$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "subscriptions_restaurant_admins_select" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "subscriptions_restaurant_admins_insert" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "subscriptions_restaurant_admins_update" ON public.subscriptions';

    EXECUTE $policy$
      CREATE POLICY "subscriptions_restaurant_admins_select" ON public.subscriptions
        FOR SELECT TO authenticated
        USING (
          restaurant_id IS NOT NULL
          AND (
            public.is_restaurant_admin(auth.uid(), restaurant_id)
            OR public.has_role(auth.uid(), 'super_admin')
          )
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "subscriptions_restaurant_admins_insert" ON public.subscriptions
        FOR INSERT TO authenticated
        WITH CHECK (
          restaurant_id IS NOT NULL
          AND (
            public.is_restaurant_admin(auth.uid(), restaurant_id)
            OR public.has_role(auth.uid(), 'super_admin')
          )
        )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "subscriptions_restaurant_admins_update" ON public.subscriptions
        FOR UPDATE TO authenticated
        USING (
          restaurant_id IS NOT NULL
          AND (
            public.is_restaurant_admin(auth.uid(), restaurant_id)
            OR public.has_role(auth.uid(), 'super_admin')
          )
        )
        WITH CHECK (
          restaurant_id IS NOT NULL
          AND (
            public.is_restaurant_admin(auth.uid(), restaurant_id)
            OR public.has_role(auth.uid(), 'super_admin')
          )
        )
    $policy$;
  END IF;
END $$;
