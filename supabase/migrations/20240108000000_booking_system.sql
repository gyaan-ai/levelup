-- Booking System: session modes, partner sessions, participants, join requests
-- Run after existing migrations

-- Add new columns to sessions table
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS session_mode TEXT DEFAULT 'private'
    CHECK (session_mode IN ('private', 'sibling', 'partner-invite', 'partner-open')),
  ADD COLUMN IF NOT EXISTS partner_invite_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_participants INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS price_per_participant DECIMAL(10,2);

-- Allow 'pending_payment' status for new bookings
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show', 'pending_payment'));

-- Session participants: multiple youth wrestlers per session
CREATE TABLE IF NOT EXISTS public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  youth_wrestler_id UUID REFERENCES public.youth_wrestlers(id) ON DELETE SET NULL,
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  paid BOOLEAN DEFAULT FALSE,
  amount_paid DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, youth_wrestler_id)
);

-- Join requests for open partner sessions
CREATE TABLE IF NOT EXISTS public.session_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  requesting_parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  youth_wrestler_id UUID NOT NULL REFERENCES public.youth_wrestlers(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(session_id, youth_wrestler_id)
);

-- Notifications (simple in-app)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_parent ON public.session_participants(parent_id);
CREATE INDEX IF NOT EXISTS idx_session_join_requests_session ON public.session_join_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_session_join_requests_parent ON public.session_join_requests(requesting_parent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_sessions_partner_invite ON public.sessions(partner_invite_code) WHERE partner_invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_mode_open ON public.sessions(session_mode, current_participants, max_participants) WHERE session_mode = 'partner-open';

-- RLS for new tables
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- session_participants: parent sees own; session parent sees all for that session
CREATE POLICY "Participants: parent sees own"
  ON public.session_participants FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());

CREATE POLICY "Participants: session parent manages"
  ON public.session_participants FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.parent_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.parent_id = auth.uid())
  );

-- session_join_requests: requester sees own; session parent sees all for that session
CREATE POLICY "Join requests: select own or for my session"
  ON public.session_join_requests FOR SELECT
  TO authenticated
  USING (
    requesting_parent_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.parent_id = auth.uid())
  );

CREATE POLICY "Join requests: parent can insert own request"
  ON public.session_join_requests FOR INSERT
  TO authenticated
  WITH CHECK (requesting_parent_id = auth.uid());

CREATE POLICY "Join requests: session parent can update (approve/decline)"
  ON public.session_join_requests FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.parent_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.parent_id = auth.uid()));

-- notifications: user sees own
CREATE POLICY "Notifications: user sees own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Notifications: user updates own (mark read)"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service/API will insert notifications (via service role or dedicated policy if needed)
CREATE POLICY "Notifications: insert for self"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
