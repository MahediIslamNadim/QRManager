-- Add user_id to dedicated_managers so managers can log in
ALTER TABLE public.dedicated_managers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Allow dedicated managers to view restaurants they're assigned to
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Managers can view assigned restaurants'
    AND tablename = 'restaurants'
  ) THEN
    CREATE POLICY "Managers can view assigned restaurants"
      ON public.restaurants FOR SELECT TO authenticated
      USING (
        dedicated_manager_id IN (
          SELECT id FROM public.dedicated_managers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow dedicated managers to access messages for their assigned restaurants
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Managers can access assigned restaurant messages'
    AND tablename = 'manager_messages'
  ) THEN
    CREATE POLICY "Managers can access assigned restaurant messages"
      ON public.manager_messages FOR ALL TO authenticated
      USING (
        restaurant_id IN (
          SELECT r.id FROM public.restaurants r
          JOIN public.dedicated_managers dm ON r.dedicated_manager_id = dm.id
          WHERE dm.user_id = auth.uid()
        )
      )
      WITH CHECK (
        restaurant_id IN (
          SELECT r.id FROM public.restaurants r
          JOIN public.dedicated_managers dm ON r.dedicated_manager_id = dm.id
          WHERE dm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow dedicated managers to read their own profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Managers can view own profile'
    AND tablename = 'dedicated_managers'
  ) THEN
    CREATE POLICY "Managers can view own profile"
      ON public.dedicated_managers FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Allow dedicated managers to update their own profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Managers can update own profile'
    AND tablename = 'dedicated_managers'
  ) THEN
    CREATE POLICY "Managers can update own profile"
      ON public.dedicated_managers FOR UPDATE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
