-- Playbook actions tracking
-- Records when coaches take action (text, call) on playbook items

CREATE TABLE IF NOT EXISTS public.playbook_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  registration_id UUID REFERENCES public.session_registrations(id) ON DELETE SET NULL,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('athlete', 'parent')),
  contact_id UUID, -- youth_wrestler_id or parent user_id
  action_type TEXT NOT NULL CHECK (action_type IN ('welcome', 'pre_session', 'post_session', 'review_request', 'birthday')),
  actioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_playbook_actions_coach_id ON public.playbook_actions(coach_id);
CREATE INDEX IF NOT EXISTS idx_playbook_actions_session_id ON public.playbook_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_playbook_actions_actioned_at ON public.playbook_actions(actioned_at);

-- RLS policies
ALTER TABLE public.playbook_actions ENABLE ROW LEVEL SECURITY;

-- Coaches can view and create their own actions
CREATE POLICY "Coaches can view own playbook actions"
  ON public.playbook_actions FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can create own playbook actions"
  ON public.playbook_actions FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

-- Admins can view all
CREATE POLICY "Admins can view all playbook actions"
  ON public.playbook_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.playbook_actions IS 'Tracks coach outreach actions for playbook items';
