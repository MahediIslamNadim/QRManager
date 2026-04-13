-- Custom Branding columns for restaurants table
-- Run this in Supabase SQL Editor

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS logo_url        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS brand_primary   TEXT DEFAULT NULL,  -- e.g. '#f97316'
  ADD COLUMN IF NOT EXISTS brand_secondary TEXT DEFAULT NULL,  -- e.g. '#fb923c'
  ADD COLUMN IF NOT EXISTS brand_font      TEXT DEFAULT 'default'; -- 'default' | 'serif' | 'mono' | 'rounded'

-- Storage bucket for logos (run once)
-- Go to Supabase Dashboard → Storage → New bucket
-- Name: restaurant-logos
-- Public: true

-- RLS: allow restaurant owner to upload their own logo
-- (Storage policies are set in the Dashboard under Storage → Policies)
