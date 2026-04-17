-- Migration: Create reviews table for per-item customer ratings
-- Date: April 17, 2026

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast per-item rating queries
CREATE INDEX IF NOT EXISTS idx_reviews_menu_item_id ON reviews(menu_item_id);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews (public menu shows ratings)
CREATE POLICY IF NOT EXISTS "reviews_public_read"
  ON reviews FOR SELECT
  USING (true);

-- Anyone can insert a review (customers submit via menu)
CREATE POLICY IF NOT EXISTS "reviews_public_insert"
  ON reviews FOR INSERT
  WITH CHECK (true);
