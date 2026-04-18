-- Dedicated manager profiles
CREATE TABLE IF NOT EXISTS public.dedicated_managers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  photo_url TEXT,
  bio TEXT,
  specialty TEXT DEFAULT 'রেস্টুরেন্ট ম্যানেজমেন্ট',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assign manager to restaurant
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS dedicated_manager_id UUID REFERENCES public.dedicated_managers(id) ON DELETE SET NULL;

-- Messages between restaurant and their manager
CREATE TABLE IF NOT EXISTS public.manager_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('restaurant', 'manager')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.dedicated_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active managers"
  ON public.dedicated_managers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admins can manage managers"
  ON public.dedicated_managers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Owners can view own messages"
  ON public.manager_messages FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Owners can send messages"
  ON public.manager_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'restaurant' AND
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
  );

CREATE POLICY "Super admins can view all messages"
  ON public.manager_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can reply as manager"
  ON public.manager_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can update messages"
  ON public.manager_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

GRANT SELECT ON public.dedicated_managers TO authenticated;
GRANT SELECT, INSERT ON public.manager_messages TO authenticated;
GRANT UPDATE (is_read) ON public.manager_messages TO authenticated;
