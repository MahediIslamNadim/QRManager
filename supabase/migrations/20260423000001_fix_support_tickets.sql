-- Fix support_tickets: add updated_at trigger + UPDATE/DELETE RLS policies
--
-- Problems fixed:
-- 1. updated_at column never auto-updated on changes
-- 2. No UPDATE policy → ticket status/admin_reply could never be saved
-- 3. Super admins had no way to reply to tickets

-- 1. updated_at auto-trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- 2. Allow owners to update their own tickets (e.g. close/cancel)
DROP POLICY IF EXISTS "Owners can update own tickets" ON public.support_tickets;
CREATE POLICY "Owners can update own tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
  ))
  WITH CHECK (restaurant_id IN (
    SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
  ));
-- 3. Allow super admins (service_role) to update any ticket (for admin replies)
GRANT UPDATE ON public.support_tickets TO service_role;
-- 4. Grant UPDATE to authenticated as well (needed for owner self-close)
GRANT UPDATE ON public.support_tickets TO authenticated;
