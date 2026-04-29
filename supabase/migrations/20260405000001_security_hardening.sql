-- =============================================================================
-- SECURITY HARDENING MIGRATION
-- Fixes: P0 privilege escalation, cross-tenant data leak, seat hijack,
--        waiter scope, storage cross-tenant write, payment forgery (P1),
--        admin_invites schema mismatch (P2)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPER: check if a user is staff (waiter/admin) of a given restaurant
-- Used in RLS policies below to scope waiter access to their own restaurant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_restaurant_staff(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_restaurants
    WHERE user_id = _user_id AND restaurant_id = _restaurant_id
  )
  OR EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = _restaurant_id AND owner_id = _user_id
  )
$$;
-- ---------------------------------------------------------------------------
-- P0 FIX 1: user_roles INSERT privilege escalation
-- Before: `OR user_id = auth.uid()` let any user self-assign super_admin.
-- After : only super_admin may insert roles via RLS.
--         The create-staff edge function uses service_role key → bypasses RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admins can insert roles" ON public.user_roles;
CREATE POLICY "Super admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
-- ---------------------------------------------------------------------------
-- P0 FIX 2: orders cross-tenant SELECT leak
-- Before: USING (true) — anyone could dump all orders.
-- After : anon may only see orders for a table that has an active session
--         (i.e. a customer who scanned the QR). Authenticated staff/admin
--         see only their own restaurant's orders.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view orders"           ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders for restaurant" ON public.orders;
CREATE POLICY "Orders are visible to restaurant stakeholders" ON public.orders
  FOR SELECT
  USING (
    -- owner or super_admin
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    -- waiter scoped to their own restaurant (P0 Fix 5 below also covers UPDATE)
    OR public.is_restaurant_staff(auth.uid(), restaurant_id)
    -- anon customer: table must have an active session (valid QR scan)
    OR EXISTS (
      SELECT 1 FROM public.table_sessions ts
      WHERE ts.table_id  = orders.table_id
        AND ts.restaurant_id = orders.restaurant_id
        AND ts.expires_at > now()
    )
  );
-- ---------------------------------------------------------------------------
-- P0 FIX 3: order_items cross-tenant SELECT leak
-- Before: USING (true).
-- After : mirrors orders policy via join.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view order items"  ON public.order_items;
DROP POLICY IF EXISTS "Anyone can view order items"  ON public.order_items;
CREATE POLICY "Order items visible to restaurant stakeholders" ON public.order_items
  FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE
        o.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.is_restaurant_staff(auth.uid(), o.restaurant_id)
        OR EXISTS (
          SELECT 1 FROM public.table_sessions ts
          WHERE ts.table_id      = o.table_id
            AND ts.restaurant_id = o.restaurant_id
            AND ts.expires_at    > now()
        )
    )
  );
-- ---------------------------------------------------------------------------
-- P0 FIX 4: table_seats open UPDATE (seat hijack / DoS)
-- Before: FOR UPDATE USING (true) WITH CHECK (true) — anyone could mark any
--         seat occupied/available.
-- After : only authenticated admin/staff may update seats via RLS.
--         Customers occupy seats via the SECURITY DEFINER trigger
--         (mark_seat_occupied fires on order INSERT) — no client UPDATE needed.
--         A new SECURITY DEFINER function lets customers release their seat
--         only if they hold a valid session token for that table.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can update seat status" ON public.table_seats;
-- Customers no longer need direct UPDATE on table_seats;
-- the mark_seat_occupied trigger handles occupation on order insert.

-- New function: customer releases seat with token validation
CREATE OR REPLACE FUNCTION public.release_seat_with_token(p_seat_id uuid, p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_id uuid;
BEGIN
  -- Resolve the table the seat belongs to
  SELECT table_id INTO v_table_id
  FROM public.table_seats
  WHERE id = p_seat_id;

  IF v_table_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verify caller holds a non-expired session token for this table
  IF NOT EXISTS (
    SELECT 1 FROM public.table_sessions
    WHERE table_id  = v_table_id
      AND token     = p_token
      AND expires_at > now()
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.table_seats
  SET status = 'available'
  WHERE id = p_seat_id;

  RETURN true;
END;
$$;
-- ---------------------------------------------------------------------------
-- P0 FIX 5: waiter not restaurant-scoped (orders UPDATE / order_items UPDATE+DELETE)
-- Before: `OR has_role(..., 'waiter')` with no restaurant check.
-- After : waiter may only mutate orders/items for their own restaurant.
-- ---------------------------------------------------------------------------

-- orders UPDATE
DROP POLICY IF EXISTS "Admins can update orders"              ON public.orders;
DROP POLICY IF EXISTS "Admins and waiters can update orders"  ON public.orders;
CREATE POLICY "Staff can update own restaurant orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.is_restaurant_staff(auth.uid(), restaurant_id)
  );
-- order_items UPDATE
DROP POLICY IF EXISTS "Admins and waiters can update order items" ON public.order_items;
CREATE POLICY "Staff can update own restaurant order items" ON public.order_items
  FOR UPDATE TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE
        o.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.is_restaurant_staff(auth.uid(), o.restaurant_id)
    )
  );
-- order_items DELETE
DROP POLICY IF EXISTS "Admins and waiters can delete order items" ON public.order_items;
CREATE POLICY "Staff can delete own restaurant order items" ON public.order_items
  FOR DELETE TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE
        o.restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.is_restaurant_staff(auth.uid(), o.restaurant_id)
    )
  );
-- ---------------------------------------------------------------------------
-- P1 FIX 6: menu-images cross-tenant writable
-- Before: any authenticated user could upload/update/delete any image path.
-- After : upload path must start with the caller's own restaurant id.
--         Format enforced: {restaurant_id}/{filename}
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete menu images" ON storage.objects;
CREATE POLICY "Restaurant owners can upload menu images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY "Restaurant owners can update menu images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );
CREATE POLICY "Restaurant owners can delete menu images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );
-- ---------------------------------------------------------------------------
-- P1 FIX 7: payment_request forgery
-- Before: INSERT only checked user_id = auth.uid(); restaurant_id unvalidated.
-- After : restaurant_id must be owned by the caller.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create own payment requests" ON public.payment_requests;
CREATE POLICY "Users can create own payment requests" ON public.payment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );
-- ---------------------------------------------------------------------------
-- P2 FIX 8: admin_invites schema mismatch
-- UI inserts: invited_name, expires_at (not in schema)
-- Schema requires: invited_by (NOT NULL, missing from UI insert)
-- Fix: add the missing columns so UI insert succeeds; invited_by gets a
--      default of auth.uid() via a trigger so UI doesn't need to send it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_invites
  ADD COLUMN IF NOT EXISTS invited_name text,
  ADD COLUMN IF NOT EXISTS expires_at   timestamptz DEFAULT (now() + interval '7 days');
-- Auto-fill invited_by from the calling user if not provided
CREATE OR REPLACE FUNCTION public.set_invite_invited_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invited_by IS NULL THEN
    NEW.invited_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_invite_invited_by ON public.admin_invites;
CREATE TRIGGER trg_set_invite_invited_by
  BEFORE INSERT ON public.admin_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invite_invited_by();
