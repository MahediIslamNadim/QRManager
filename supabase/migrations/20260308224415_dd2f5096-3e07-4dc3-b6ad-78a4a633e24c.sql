
CREATE OR REPLACE FUNCTION public.increment_table_customers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.table_id IS NOT NULL THEN
    UPDATE public.restaurant_tables
    SET current_customers = LEAST(current_customers + 1, seats),
        status = 'occupied'
    WHERE id = NEW.table_id AND current_customers = 0;
    
    -- If already has customers, just ensure status is occupied
    UPDATE public.restaurant_tables
    SET status = 'occupied'
    WHERE id = NEW.table_id AND current_customers > 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_order_increment_customers
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_table_customers();
