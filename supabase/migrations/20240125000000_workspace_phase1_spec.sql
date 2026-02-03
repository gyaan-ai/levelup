-- Phase 1 spec: workspace status/activity, message_type, auto-create on first session, system message

-- 1. Workspaces: add status, last_activity_at, total_sessions
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_workspaces_status ON public.workspaces(status);

-- 2. Workspace messages: add message_type (text | system)
ALTER TABLE public.workspace_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system'));

-- 3. get_or_create_workspace: insert system message when creating
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

    INSERT INTO public.workspace_messages (workspace_id, author_id, content, message_type)
    VALUES (
      v_workspace_id,
      p_athlete_id,
      'Workspace created! This is your collaboration space. Use it to communicate, share videos, and track progress.',
      'system'
    );
  END IF;

  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger: auto-create workspace when first session participant is added
CREATE OR REPLACE FUNCTION public.create_workspace_on_first_session()
RETURNS TRIGGER AS $$
DECLARE
  v_athlete_id UUID;
BEGIN
  SELECT athlete_id INTO v_athlete_id
  FROM public.sessions
  WHERE id = NEW.session_id;

  IF v_athlete_id IS NOT NULL AND NEW.youth_wrestler_id IS NOT NULL AND NEW.parent_id IS NOT NULL THEN
    PERFORM public.get_or_create_workspace(NEW.parent_id, NEW.youth_wrestler_id, v_athlete_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_workspace_on_first_session_trigger ON public.session_participants;
CREATE TRIGGER create_workspace_on_first_session_trigger
  AFTER INSERT ON public.session_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_workspace_on_first_session();

COMMENT ON COLUMN public.workspaces.status IS 'active or archived';
COMMENT ON COLUMN public.workspaces.last_activity_at IS 'Last message or activity in workspace';
COMMENT ON COLUMN public.workspaces.total_sessions IS 'Number of sessions for this athlete-coach pair';
COMMENT ON COLUMN public.workspace_messages.message_type IS 'text (user message) or system (e.g. welcome)';
