-- Fix drifted RLS on public.credits that referenced user_id (column is parent_id).
-- Without this, policies can error with: column credits.user_id does not exist.

DROP POLICY IF EXISTS "Parents can view own credits" ON public.credits;
CREATE POLICY "Parents can view own credits"
  ON public.credits FOR SELECT
  USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "Parents can view own credit usage" ON public.credit_usage;
CREATE POLICY "Parents can view own credit usage"
  ON public.credit_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.credits c
      WHERE c.id = credit_usage.credit_id AND c.parent_id = auth.uid()
    )
  );
