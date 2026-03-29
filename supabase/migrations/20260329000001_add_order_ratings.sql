-- Add rating columns to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_comment TEXT;

-- Index for fast avg rating queries per restaurant
CREATE INDEX IF NOT EXISTS idx_orders_rating ON orders(restaurant_id, rating) WHERE rating IS NOT NULL;
