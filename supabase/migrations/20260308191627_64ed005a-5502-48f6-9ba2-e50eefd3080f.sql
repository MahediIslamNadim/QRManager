
-- Fix permissive INSERT policies for orders and order_items
-- Orders: allow inserts only when restaurant_id is valid
DROP POLICY "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE status = 'active')
);

-- Order items: allow inserts only when order_id exists
DROP POLICY "Anyone can create order items" ON public.order_items;
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (
  order_id IN (SELECT id FROM public.orders)
);
