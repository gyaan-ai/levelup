-- Session summaries for post-session coaching notes

CREATE TABLE IF NOT EXISTS public.session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,

  -- Session content
  focus_areas TEXT[],
  what_we_worked_on TEXT NOT NULL,
  progress_notes TEXT,
  next_session_plan TEXT,

  -- Optional ratings
  overall_effort INTEGER CHECK (overall_effort >= 1 AND overall_effort <= 5),
  technical_progress INTEGER CHECK (technical_progress >= 1 AND technical_progress <= 5),

  -- Metadata
  coach_id UUID NOT NULL REFERENCES public.athletes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_workspace ON public.session_summaries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_session ON public.session_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_coach ON public.session_summaries(coach_id);

ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;

-- Workspace members can view summaries
DROP POLICY IF EXISTS "Workspace members can view session summaries" ON public.session_summaries;
CREATE POLICY "Workspace members can view session summaries"
  ON public.session_summaries FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE parent_id = auth.uid()
         OR athlete_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Only coach can create/update summaries for their workspace
DROP POLICY IF EXISTS "Coach can create session summaries" ON public.session_summaries;
CREATE POLICY "Coach can create session summaries"
  ON public.session_summaries FOR INSERT
  WITH CHECK (
    auth.uid() = coach_id
    AND workspace_id IN (SELECT id FROM public.workspaces WHERE athlete_id = auth.uid())
  );

DROP POLICY IF EXISTS "Coach can update their session summaries" ON public.session_summaries;
CREATE POLICY "Coach can update their session summaries"
  ON public.session_summaries FOR UPDATE
  USING (
    auth.uid() = coach_id
    AND workspace_id IN (SELECT id FROM public.workspaces WHERE athlete_id = auth.uid())
  );
