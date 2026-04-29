-- Enterprise sanitization hardening
-- Created: April 26, 2026
-- Adds DB-level constraints to catch invalid data even if frontend bypassed

-- 1. branch_invitations: email format constraint
--    (basic sanity: contains @, reasonable length)
ALTER TABLE public.branch_invitations
  DROP CONSTRAINT IF EXISTS branch_invitations_email_format,
  ADD CONSTRAINT branch_invitations_email_format
    CHECK (
      invited_email = lower(invited_email)             -- must be lowercase
      AND char_length(invited_email) BETWEEN 3 AND 320 -- 3 = a@b  minimum
      AND invited_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' -- basic @ + domain check
    );
-- 2. restaurants: branch_code cannot contain whitespace or special injection chars
ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_branch_code_safe,
  ADD CONSTRAINT restaurants_branch_code_safe
    CHECK (
      branch_code IS NULL
      OR (
        char_length(branch_code) BETWEEN 1 AND 20
        AND branch_code !~ '['';<>]'   -- no SQL/HTML injection characters
      )
    );
-- 3. restaurant_groups: name must not be empty after trim
ALTER TABLE public.restaurant_groups
  DROP CONSTRAINT IF EXISTS restaurant_groups_name_nonempty,
  ADD CONSTRAINT restaurant_groups_name_nonempty
    CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 200);
-- 4. group_shared_menus: price must be non-negative, name non-empty
ALTER TABLE public.group_shared_menus
  DROP CONSTRAINT IF EXISTS group_shared_menus_price_positive,
  ADD CONSTRAINT group_shared_menus_price_positive
    CHECK (price >= 0);
ALTER TABLE public.group_shared_menus
  DROP CONSTRAINT IF EXISTS group_shared_menus_name_nonempty,
  ADD CONSTRAINT group_shared_menus_name_nonempty
    CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 200);
-- 5. branch_menu_overrides: custom_price non-negative when set
ALTER TABLE public.branch_menu_overrides
  DROP CONSTRAINT IF EXISTS branch_overrides_price_positive,
  ADD CONSTRAINT branch_overrides_price_positive
    CHECK (custom_price IS NULL OR custom_price >= 0);
