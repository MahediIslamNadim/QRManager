-- Allow restaurant owners to insert a dedicated manager for themselves
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can insert own manager' AND tablename = 'dedicated_managers') THEN
    CREATE POLICY "Owners can insert own manager"
      ON public.dedicated_managers FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update own manager' AND tablename = 'dedicated_managers') THEN
    CREATE POLICY "Owners can update own manager"
      ON public.dedicated_managers FOR UPDATE TO authenticated
      USING (id IN (SELECT dedicated_manager_id FROM public.restaurants WHERE owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can delete own manager' AND tablename = 'dedicated_managers') THEN
    CREATE POLICY "Owners can delete own manager"
      ON public.dedicated_managers FOR DELETE TO authenticated
      USING (id IN (SELECT dedicated_manager_id FROM public.restaurants WHERE owner_id = auth.uid()));
  END IF;
END $$;

GRANT INSERT, UPDATE, DELETE ON public.dedicated_managers TO authenticated;
