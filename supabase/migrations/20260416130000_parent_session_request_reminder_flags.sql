-- One-time flags for cron-driven reminders (12h coach nudge, ~12h parent payment nudge)
ALTER TABLE public.parent_session_requests
  ADD COLUMN IF NOT EXISTS coach_reminder_sent_at TIMESTAMPTZ;

ALTER TABLE public.parent_session_requests
  ADD COLUMN IF NOT EXISTS parent_pay_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.parent_session_requests.coach_reminder_sent_at IS 'Set when 12h pending reminder was sent to coach.';
COMMENT ON COLUMN public.parent_session_requests.parent_pay_reminder_sent_at IS 'Set when ~12h-left payment reminder was sent to parent.';
