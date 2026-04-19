-- Parents can request a custom session (time/type/facility) before a session exists.
-- Idempotent: safe if 20260204120001_parent_session_requests.sql already ran.
CREATE TABLE IF NOT EXISTS public.parent_session_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  youth_wrestler_id UUID NOT NULL REFERENCES public.youth_wrestlers(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  preferred_datetime TIMESTAMPTZ,
  session_type TEXT CHECK (
    session_type IS NULL OR session_type IN ('private', 'small_group', 'partner', 'group')
  ),
  message TEXT,
  flexibility_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  coach_response TEXT,
  created_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parent_session_requests_has_detail CHECK (
    (message IS NOT NULL AND length(trim(message)) > 0)
    OR preferred_datetime IS NOT NULL
    OR (flexibility_note IS NOT NULL AND length(trim(flexibility_note)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_parent_session_requests_parent ON public.parent_session_requests(requesting_parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_session_requests_coach_status ON public.parent_session_requests(coach_id, status);
CREATE INDEX IF NOT EXISTS idx_parent_session_requests_created ON public.parent_session_requests(created_at DESC);

ALTER TABLE public.parent_session_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parent session requests: select own or coach" ON public.parent_session_requests;
CREATE POLICY "Parent session requests: select own or coach"
  ON public.parent_session_requests FOR SELECT
  TO authenticated
  USING (
    requesting_parent_id = auth.uid()
    OR coach_id = auth.uid()
  );

DROP POLICY IF EXISTS "Parent session requests: insert own" ON public.parent_session_requests;
CREATE POLICY "Parent session requests: insert own"
  ON public.parent_session_requests FOR INSERT
  TO authenticated
  WITH CHECK (requesting_parent_id = auth.uid());

DROP POLICY IF EXISTS "Parent session requests: coach respond" ON public.parent_session_requests;
CREATE POLICY "Parent session requests: coach respond"
  ON public.parent_session_requests FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid() AND status = 'pending')
  WITH CHECK (
    coach_id = auth.uid()
    AND status IN ('approved', 'declined')
  );

DROP POLICY IF EXISTS "Parent session requests: parent cancel" ON public.parent_session_requests;
CREATE POLICY "Parent session requests: parent cancel"
  ON public.parent_session_requests FOR UPDATE
  TO authenticated
  USING (requesting_parent_id = auth.uid() AND status = 'pending')
  WITH CHECK (requesting_parent_id = auth.uid() AND status = 'cancelled');

-- Coach-specific date blocks (overrides recurring / slot rows for "not available this day")
CREATE TABLE IF NOT EXISTS public.athlete_availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(athlete_id, blocked_date)
);

CREATE INDEX IF NOT EXISTS idx_athlete_availability_blocks_athlete_date
  ON public.athlete_availability_blocks(athlete_id, blocked_date);

ALTER TABLE public.athlete_availability_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read athlete availability blocks" ON public.athlete_availability_blocks;
CREATE POLICY "Anyone can read athlete availability blocks"
  ON public.athlete_availability_blocks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Coaches manage own availability blocks" ON public.athlete_availability_blocks;
CREATE POLICY "Coaches manage own availability blocks"
  ON public.athlete_availability_blocks FOR ALL
  TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Parent session requests: duration, counter proposal, payment window + expanded status
ALTER TABLE public.parent_session_requests
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60;

ALTER TABLE public.parent_session_requests
  ADD COLUMN IF NOT EXISTS counter_preferred_datetime TIMESTAMPTZ;

ALTER TABLE public.parent_session_requests
  ADD COLUMN IF NOT EXISTS counter_note TEXT;

ALTER TABLE public.parent_session_requests
  ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMPTZ;

ALTER TABLE public.parent_session_requests
  DROP CONSTRAINT IF EXISTS parent_session_requests_status_check;

ALTER TABLE public.parent_session_requests
  ADD CONSTRAINT parent_session_requests_status_check
  CHECK (status IN ('pending', 'approved', 'declined', 'cancelled', 'countered', 'expired'));

COMMENT ON COLUMN public.parent_session_requests.payment_deadline_at IS 'When set (e.g. coach approved), parent should complete checkout by this time (24h window).';
COMMENT ON TABLE public.athlete_availability_blocks IS 'Whole days the coach is unavailable for private/partner requests despite recurring availability.';
