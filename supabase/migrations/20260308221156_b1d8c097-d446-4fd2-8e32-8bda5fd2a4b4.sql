
-- Allow admins and waiters to update order items
CREATE POLICY "Admins and waiters can update order items"
ON public.order_items FOR UPDATE
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
    WHERE r.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'waiter')
);

-- Allow admins and waiters to delete order items
CREATE POLICY "Admins and waiters can delete order items"
ON public.order_items FOR DELETE
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
    WHERE r.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin')
  OR has_role(auth.uid(), 'waiter')
);
