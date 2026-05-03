-- =============================================================================
-- AI Feedback Analysis cache
-- Stores generated sentiment summaries for restaurant feedback/reviews.
-- Edge Function writes with service role; admins can read their own summaries.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feedback_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'fallback' CHECK (source IN ('gemini', 'fallback')),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id)
);

CREATE INDEX IF NOT EXISTS feedback_ai_summaries_restaurant_idx
  ON public.feedback_ai_summaries (restaurant_id, generated_at DESC);

ALTER TABLE public.feedback_ai_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant admins can view feedback AI summaries"
  ON public.feedback_ai_summaries;

CREATE POLICY "Restaurant admins can view feedback AI summaries"
  ON public.feedback_ai_summaries
  FOR SELECT TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.restaurant_id = feedback_ai_summaries.restaurant_id
        AND ur.role = 'admin'::public.app_role
    )
  );
