-- Collaboration area: parent, coach, athlete can message back and forth with timestamps

CREATE TABLE IF NOT EXISTS public.workspace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_messages_workspace ON public.workspace_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_messages_created ON public.workspace_messages(created_at);

ALTER TABLE public.workspace_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view messages"
  ON public.workspace_messages FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE parent_id = auth.uid()
         OR athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Workspace members can add messages"
  ON public.workspace_messages FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM public.workspaces
      WHERE parent_id = auth.uid()
         OR athlete_id IN (SELECT id FROM public.athletes WHERE id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
    AND author_id = auth.uid()
  );

COMMENT ON TABLE public.workspace_messages IS 'Collaboration thread: parent, coach, athlete messages with timestamps';
