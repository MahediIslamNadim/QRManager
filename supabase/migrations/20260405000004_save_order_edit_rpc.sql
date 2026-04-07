-- =============================================================================
-- TRANSACTIONAL ORDER EDIT RPC
-- Replaces the three-step client-side sequence in useOrderActions.saveOrderEdit:
--   1. DELETE items with quantity = 0
--   2. UPDATE items with quantity > 0
--   3. UPDATE orders.total
-- Because those three steps ran as separate statements, a mid-flight error left
-- the row in a partial state. This function wraps everything in a single PL/pgSQL
-- transaction so either all changes commit or none do.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.save_order_edit(
  p_order_id      uuid,
  p_restaurant_id uuid,
  p_items         jsonb   -- [{"id":"<uuid>","quantity":N}, ...]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    jsonb;
  v_item_id uuid;
  v_qty     int;
  v_total   numeric;
BEGIN
  -- Authorization: caller must own the restaurant, be staff, or be super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id             = p_order_id
      AND o.restaurant_id  = p_restaurant_id
      AND (
        o.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.is_restaurant_staff(auth.uid(), p_restaurant_id)
      )
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Process each item atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_id := (v_item->>'id')::uuid;
    v_qty     := (v_item->>'quantity')::int;

    IF v_qty = 0 THEN
      DELETE FROM public.order_items
      WHERE id = v_item_id AND order_id = p_order_id;
    ELSE
      UPDATE public.order_items
      SET quantity = v_qty
      WHERE id = v_item_id AND order_id = p_order_id;
    END IF;
  END LOOP;

  -- Recalculate total from remaining items (source of truth = DB rows)
  SELECT COALESCE(SUM(price * quantity), 0)
  INTO   v_total
  FROM   public.order_items
  WHERE  order_id = p_order_id;

  UPDATE public.orders
  SET    total = v_total
  WHERE  id = p_order_id AND restaurant_id = p_restaurant_id;
END;
$$;
