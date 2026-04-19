-- Allow restaurant staff (waiter, kitchen, admin) to read manager messages for their restaurant
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Staff can read manager messages for their restaurant'
    AND tablename = 'manager_messages'
  ) THEN
    CREATE POLICY "Staff can read manager messages for their restaurant"
      ON public.manager_messages FOR SELECT TO authenticated
      USING (
        restaurant_id IN (
          SELECT restaurant_id FROM public.staff_restaurants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow restaurant staff to INSERT messages to manager (so waiter can also message manager)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Staff can insert manager messages for their restaurant'
    AND tablename = 'manager_messages'
  ) THEN
    CREATE POLICY "Staff can insert manager messages for their restaurant"
      ON public.manager_messages FOR INSERT TO authenticated
      WITH CHECK (
        restaurant_id IN (
          SELECT restaurant_id FROM public.staff_restaurants WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
