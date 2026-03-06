-- Track when a session was refunded (Stripe). Refunds only with 24h+ notice.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sessions.refunded_at IS 'When a refund was issued for this session (Stripe). Used to avoid double-refund.';
