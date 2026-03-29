
-- Trigger: auto mark seat occupied when order is created with a seat_id
CREATE TRIGGER on_order_insert_mark_seat
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_seat_occupied();

-- Trigger: auto reset table & seats when order is completed/cancelled
CREATE TRIGGER on_order_update_reset_table
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_table_on_order_complete();

-- Trigger: auto increment table customers on new order
CREATE TRIGGER on_order_insert_increment_customers
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_table_customers();
