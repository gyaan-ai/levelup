-- App-wide standard: coach share of gross = 80% (0.8000).

ALTER TABLE public.athletes
  ALTER COLUMN payout_rate SET DEFAULT 0.8000;

UPDATE public.athletes
SET payout_rate = 0.8000;

UPDATE public.sessions
SET session_payout_rate = 0.8000;

COMMENT ON COLUMN public.athletes.payout_rate IS 'Coach revenue share of gross (default 0.80 = 80%).';
COMMENT ON COLUMN public.sessions.session_payout_rate IS 'Coach payout rate snapshotted at session creation (default 80%).';
