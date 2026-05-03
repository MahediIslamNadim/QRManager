-- =============================================================================
-- Menu Intelligence suggestions
-- Stores AI-generated menu item suggestions for owner/admin review history.
-- Writes happen through the menu-intelligence Edge Function with service role.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.menu_intelligence_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggestion jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'fallback' CHECK (source IN ('gemini', 'fallback')),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_intelligence_suggestions_restaurant_idx
  ON public.menu_intelligence_suggestions (restaurant_id, created_at DESC);

ALTER TABLE public.menu_intelligence_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant admins can view menu intelligence suggestions"
  ON public.menu_intelligence_suggestions;

CREATE POLICY "Restaurant admins can view menu intelligence suggestions"
  ON public.menu_intelligence_suggestions
  FOR SELECT TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.restaurant_id = menu_intelligence_suggestions.restaurant_id
        AND ur.role = 'admin'::public.app_role
    )
  );
