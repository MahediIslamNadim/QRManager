-- ============================================================
-- Fix: Custom Branding Storage + DB columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add branding columns to restaurants table (if not exist)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary TEXT DEFAULT '#f97316',
  ADD COLUMN IF NOT EXISTS brand_secondary TEXT DEFAULT '#fb923c',
  ADD COLUMN IF NOT EXISTS brand_font TEXT DEFAULT 'default';

-- 2. Create restaurant-logos storage bucket via SQL helper
-- NOTE: You must also create this bucket in Supabase Dashboard > Storage
-- Bucket name: restaurant-logos  (Public: true)
-- If bucket already exists, skip the INSERT below

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-logos',
  'restaurant-logos',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152;

-- 3. Storage policies for restaurant-logos bucket
DROP POLICY IF EXISTS "Restaurant owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant owners can update logos" ON storage.objects;

CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-logos');

CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-logos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'restaurant-logos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurant-logos'
  AND auth.role() = 'authenticated'
);

-- 4. RLS policy for branding fields on restaurants table
-- Owners should be able to update their own restaurant branding
DROP POLICY IF EXISTS "Restaurant owners can update branding" ON public.restaurants;
CREATE POLICY "Restaurant owners can update branding" ON public.restaurants
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.staff_restaurants
      WHERE restaurant_id = restaurants.id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

SELECT 'Custom branding setup complete!' AS result;
