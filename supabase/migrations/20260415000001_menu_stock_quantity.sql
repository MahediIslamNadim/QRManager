-- Add stock_quantity column to menu_items
-- NULL = unlimited stock (no tracking)
-- 0+  = tracked stock; 0 means out of stock
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT NULL;

-- Trigger: decrement stock when order items are inserted
CREATE OR REPLACE FUNCTION public.decrement_menu_item_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on items that have stock tracking (stock_quantity IS NOT NULL)
  UPDATE public.menu_items
  SET
    stock_quantity = GREATEST(0, stock_quantity - NEW.quantity),
    -- Auto mark unavailable when stock hits 0
    available = CASE
      WHEN (stock_quantity - NEW.quantity) <= 0 THEN false
      ELSE available
    END,
    updated_at = now()
  WHERE id = NEW.menu_item_id
    AND stock_quantity IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_menu_stock ON public.order_items;
CREATE TRIGGER trg_decrement_menu_stock
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.decrement_menu_item_stock();
