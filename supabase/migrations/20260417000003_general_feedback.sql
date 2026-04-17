-- Allow general restaurant-level feedback (not tied to a specific menu item)
ALTER TABLE public.reviews
  ALTER COLUMN menu_item_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id
  ON public.reviews (restaurant_id)
  WHERE restaurant_id IS NOT NULL;
