-- Add estimated preparation time (in minutes) to each menu item
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER CHECK (prep_time_minutes > 0 AND prep_time_minutes <= 180);
