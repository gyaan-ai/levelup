-- =============================================================================
-- Bump partner (2-athlete) sessions to max_participants = 3 for TODAY (Eastern).
-- Run in Supabase SQL Editor. Preview first, then run the UPDATE.
-- "Today" = calendar date in America/New_York (same as the app).
-- =============================================================================

-- 0) What "today" is in Eastern (sanity check)
SELECT (timezone('America/New_York', now()))::date AS today_eastern;

-- 1) PREVIEW — partner sessions on that calendar day with cap below 3
SELECT
  s.id,
  s.scheduled_datetime,
  (timezone('America/New_York', s.scheduled_datetime))::date AS session_date_eastern,
  s.status,
  s.session_type,
  s.session_mode,
  s.max_participants,
  s.current_participants
FROM public.sessions s
WHERE s.session_type IN ('2-athlete', 'partner')
  AND s.status IS DISTINCT FROM 'cancelled'
  AND (timezone('America/New_York', s.scheduled_datetime))::date
      = (timezone('America/New_York', now()))::date
  AND COALESCE(s.max_participants, 0) < 3
ORDER BY s.scheduled_datetime;

-- 2) APPLY — set max to 3 (idempotent: only rows still below 3)
UPDATE public.sessions s
SET max_participants = 3
WHERE s.session_type IN ('2-athlete', 'partner')
  AND s.status IS DISTINCT FROM 'cancelled'
  AND (timezone('America/New_York', s.scheduled_datetime))::date
      = (timezone('America/New_York', now()))::date
  AND COALESCE(s.max_participants, 0) < 3
RETURNING
  s.id,
  s.scheduled_datetime,
  s.session_type,
  s.max_participants,
  s.current_participants;
