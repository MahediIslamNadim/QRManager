
CREATE OR REPLACE FUNCTION public.reset_table_on_order_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When order status changes to 'completed' or 'cancelled'
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
    -- Check if there are any remaining active orders for this table
    IF NEW.table_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE table_id = NEW.table_id
        AND id != NEW.id
        AND status IN ('pending', 'preparing', 'served')
    ) THEN
      -- Reset table
      UPDATE public.restaurant_tables
      SET current_customers = 0, status = 'available'
      WHERE id = NEW.table_id;

      -- Reset all seats for this table
      UPDATE public.table_seats
      SET status = 'available'
      WHERE table_id = NEW.table_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_complete_reset_table
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_table_on_order_complete();
