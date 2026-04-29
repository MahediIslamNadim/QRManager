-- Bug 4 fix: restaurant owners must be able to mark manager messages as read.
-- The original migration (20260418000008) only granted UPDATE to super_admin
-- via RLS, so the update silently failed for restaurant admins.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Owners can update own manager messages'
    AND tablename = 'manager_messages'
  ) THEN
    CREATE POLICY "Owners can update own manager messages"
      ON public.manager_messages FOR UPDATE TO authenticated
      USING (
        restaurant_id IN (
          SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
        )
      )
      WITH CHECK (
        restaurant_id IN (
          SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
        )
      );
  END IF;
END $$;
