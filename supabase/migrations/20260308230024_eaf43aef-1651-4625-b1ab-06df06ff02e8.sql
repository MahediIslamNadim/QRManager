
-- Create table_seats table
CREATE TABLE public.table_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  seat_number integer NOT NULL,
  status text NOT NULL DEFAULT 'available',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(table_id, seat_number)
);

-- Enable RLS
ALTER TABLE public.table_seats ENABLE ROW LEVEL SECURITY;

-- Anyone can view seats (for customer menu)
CREATE POLICY "Anyone can view seats" ON public.table_seats
  FOR SELECT USING (true);

-- Admins can manage seats
CREATE POLICY "Admins can manage seats" ON public.table_seats
  FOR ALL USING (
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Anyone can update seat status (for customer check-in)
CREATE POLICY "Anyone can update seat status" ON public.table_seats
  FOR UPDATE USING (true) WITH CHECK (true);

-- Add seat_id to orders
ALTER TABLE public.orders ADD COLUMN seat_id uuid REFERENCES public.table_seats(id);

-- Enable realtime for table_seats
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_seats;

-- Trigger: auto mark seat occupied on order
CREATE OR REPLACE FUNCTION public.mark_seat_occupied()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.seat_id IS NOT NULL THEN
    UPDATE public.table_seats
    SET status = 'occupied'
    WHERE id = NEW.seat_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_mark_seat_occupied
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_seat_occupied();
