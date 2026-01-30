-- Coach follows: parents can follow/favorite coaches (NCAA wrestlers)
CREATE TABLE IF NOT EXISTS public.coach_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_follows_parent ON public.coach_follows(parent_id);
CREATE INDEX IF NOT EXISTS idx_coach_follows_coach ON public.coach_follows(coach_id);

ALTER TABLE public.coach_follows ENABLE ROW LEVEL SECURITY;

-- Parents can manage their own follows
CREATE POLICY "Parents can manage own follows"
  ON public.coach_follows FOR ALL
  TO authenticated
  USING (
    parent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'parent')
  )
  WITH CHECK (
    parent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'parent')
  );

-- Allow coaches to read who follows them (for optional UI)
CREATE POLICY "Coaches can read own followers"
  ON public.coach_follows FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'athlete')
  );
