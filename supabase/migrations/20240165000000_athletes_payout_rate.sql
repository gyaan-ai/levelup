-- Add per-coach payout rate (founding coaches get different %)
-- Default is 0.8333 (5/6 = 83.33%) but can be overridden per coach
ALTER TABLE public.athletes
ADD COLUMN IF NOT EXISTS payout_rate DECIMAL(5,4) DEFAULT 0.8333;

COMMENT ON COLUMN public.athletes.payout_rate IS 'Coach revenue share (0.8333 = 83.33% default, 0.90 = 90% for founding coaches)';

-- Snapshot the payout rate at session creation time for historical accuracy
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS session_payout_rate DECIMAL(5,4);

COMMENT ON COLUMN public.sessions.session_payout_rate IS 'Coach payout rate snapshotted at session creation. Used for earnings calculations.';

-- Add session_group_id for linking multi-date sessions (e.g., weekly recurring)
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS session_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_sessions_group_id ON public.sessions(session_group_id);

COMMENT ON COLUMN public.sessions.session_group_id IS 'Groups sessions created together (e.g., 4 Tuesdays in a row). NULL for standalone sessions.';
