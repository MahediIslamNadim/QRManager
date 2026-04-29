-- Grant table-level permissions so anon (customer) can read and write reviews
GRANT SELECT, INSERT ON public.reviews TO anon;
GRANT SELECT, INSERT ON public.reviews TO authenticated;
-- Backfill restaurant_id for existing per-item reviews that are missing it
UPDATE public.reviews r
SET restaurant_id = mi.restaurant_id
FROM public.menu_items mi
WHERE r.menu_item_id = mi.id
  AND r.restaurant_id IS NULL;
