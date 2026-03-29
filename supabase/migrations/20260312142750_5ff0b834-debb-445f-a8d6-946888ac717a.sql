
-- 1. Create table_sessions for QR token anti-spam
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE CASCADE NOT NULL,
  token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '30 minutes') NOT NULL
);

-- Enable RLS
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can view sessions (customers need to validate tokens)
CREATE POLICY "Anyone can view table sessions" ON public.table_sessions FOR SELECT TO public USING (true);

-- Anyone can create sessions (when scanning QR)
CREATE POLICY "Anyone can create table sessions" ON public.table_sessions FOR INSERT TO public WITH CHECK (true);

-- Admins can manage sessions
CREATE POLICY "Admins can manage table sessions" ON public.table_sessions FOR ALL TO authenticated
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Add is_open column to restaurant_tables
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS is_open boolean DEFAULT false;

-- 3. Add short_code column to restaurants
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS short_code text UNIQUE;

-- 4. Create admin_invites table for super admin invite system
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  restaurant_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  accepted_at timestamptz
);

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage invites" ON public.admin_invites FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 5. Function to generate random short codes
CREATE OR REPLACE FUNCTION public.generate_short_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  IF NEW.short_code IS NULL THEN
    LOOP
      new_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
      SELECT EXISTS(SELECT 1 FROM public.restaurants WHERE short_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.short_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate short_code on restaurant insert
DROP TRIGGER IF EXISTS trg_generate_short_code ON public.restaurants;
CREATE TRIGGER trg_generate_short_code
  BEFORE INSERT ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_short_code();

-- 6. Generate short_codes for existing restaurants that don't have one
UPDATE public.restaurants SET short_code = substr(md5(id::text || now()::text), 1, 8) WHERE short_code IS NULL;

-- 7. Function to validate table session token
CREATE OR REPLACE FUNCTION public.validate_table_token(_token uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_sessions
    WHERE token = _token AND expires_at > now()
  )
$$;

-- Enable realtime for table_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
