-- Development Workspaces: collaboration between parents, youth wrestlers, and coaches
-- Goals, video uploads, session summaries, and action items

-- Workspace: one per (parent, youth_wrestler, coach) relationship
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  youth_wrestler_id UUID NOT NULL REFERENCES public.youth_wrestlers(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, youth_wrestler_id, athlete_id)
);

-- Goals: what the kid wants to work on (from parent/kid or coach)
CREATE TABLE IF NOT EXISTS public.workspace_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media: videos/images for coach review
CREATE TABLE IF NOT EXISTS public.workspace_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT,
  file_name TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('video', 'image')),
  description TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session notes: coach summarizes after each session
CREATE TABLE IF NOT EXISTS public.workspace_session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  highlights TEXT,
  focus_areas TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Action items: coach assigns homework/focus before next session
CREATE TABLE IF NOT EXISTS public.workspace_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_note_id UUID REFERENCES public.workspace_session_notes(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  due_before_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_parent ON public.workspaces(parent_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_youth ON public.workspaces(youth_wrestler_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_athlete ON public.workspaces(athlete_id);
CREATE INDEX IF NOT EXISTS idx_workspace_goals_workspace ON public.workspace_goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_media_workspace ON public.workspace_media(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_notes_workspace ON public.workspace_session_notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_actions_workspace ON public.workspace_actions(workspace_id);

-- RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_actions ENABLE ROW LEVEL SECURITY;

-- Workspaces: parent and coach can view/edit
CREATE POLICY "Parent can manage own workspaces"
  ON public.workspaces FOR ALL
  USING (parent_id = auth.uid());

CREATE POLICY "Coach can manage workspaces"
  ON public.workspaces FOR ALL
  USING (
    athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid())
  );

CREATE POLICY "Admin can manage workspaces"
  ON public.workspaces FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Goals: workspace members can manage
CREATE POLICY "Workspace members can manage goals"
  ON public.workspace_goals FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE parent_id = auth.uid()
         OR athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Media: same
CREATE POLICY "Workspace members can manage media"
  ON public.workspace_media FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE parent_id = auth.uid()
         OR athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Session notes: coach creates, all can read
CREATE POLICY "Workspace members can manage session notes"
  ON public.workspace_session_notes FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE parent_id = auth.uid()
         OR athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Actions: same
CREATE POLICY "Workspace members can manage actions"
  ON public.workspace_actions FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE parent_id = auth.uid()
         OR athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- Storage bucket for workspace media (videos, images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-media',
  'workspace-media',
  false,
  52428800,  -- 50MB for videos
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'];

-- Storage policies: workspace participants can upload/read
CREATE POLICY "Workspace members can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'workspace-media' AND
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id::text = (storage.foldername(name))[1]
    AND (w.parent_id = auth.uid() OR w.athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid()))
  )
);

CREATE POLICY "Workspace members can read media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'workspace-media' AND
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id::text = (storage.foldername(name))[1]
    AND (w.parent_id = auth.uid() OR w.athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid()))
  )
);

CREATE POLICY "Workspace members can delete media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'workspace-media' AND
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id::text = (storage.foldername(name))[1]
    AND (w.parent_id = auth.uid() OR w.athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid()))
  )
);

-- Function to get or create workspace for a session
CREATE OR REPLACE FUNCTION public.get_or_create_workspace(
  p_parent_id UUID,
  p_youth_wrestler_id UUID,
  p_athlete_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT id INTO v_workspace_id
  FROM public.workspaces
  WHERE parent_id = p_parent_id
    AND youth_wrestler_id = p_youth_wrestler_id
    AND athlete_id = p_athlete_id;
  
  IF v_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (parent_id, youth_wrestler_id, athlete_id)
    VALUES (p_parent_id, p_youth_wrestler_id, p_athlete_id)
    RETURNING id INTO v_workspace_id;
  END IF;
  
  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.workspaces IS 'Collaboration space between parent, youth wrestler, and coach';
COMMENT ON TABLE public.workspace_goals IS 'What the wrestler wants to work on';
COMMENT ON TABLE public.workspace_media IS 'Videos/images for coach review';
COMMENT ON TABLE public.workspace_session_notes IS 'Coach session summaries';
COMMENT ON TABLE public.workspace_actions IS 'Coach-assigned homework before next session';
