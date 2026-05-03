-- =============================================================================
-- AI Daily Summary cache
-- Stores generated owner-facing daily summaries so the dashboard can reuse
-- today's result without paying for AI on every refresh.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'fallback' CHECK (source IN ('gemini', 'fallback')),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, summary_date)
);

CREATE INDEX IF NOT EXISTS ai_daily_summaries_restaurant_date_idx
  ON public.ai_daily_summaries (restaurant_id, summary_date DESC);

ALTER TABLE public.ai_daily_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurant admins can view AI daily summaries" ON public.ai_daily_summaries;
CREATE POLICY "Restaurant admins can view AI daily summaries"
  ON public.ai_daily_summaries
  FOR SELECT TO authenticated
  USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.restaurant_id = ai_daily_summaries.restaurant_id
        AND ur.role = 'admin'::public.app_role
    )
  );

DROP POLICY IF EXISTS "Restaurant admins can manage AI daily summaries" ON public.ai_daily_summaries;
