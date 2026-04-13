-- =============================================================================
-- Cap partner (2-athlete) sessions at max_participants = 2 for TODAY (Eastern).
-- Run in Supabase SQL Editor if any rows were raised above 2 by mistake.
-- "Today" = calendar date in America/New_York (same as the app).
-- =============================================================================

SELECT (timezone('America/New_York', now()))::date AS today_eastern;

-- PREVIEW — partner sessions on that calendar day with cap above 2
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
WHERE s.session_type = '2-athlete'
  AND s.status IS DISTINCT FROM 'cancelled'
  AND (timezone('America/New_York', s.scheduled_datetime))::date
      = (timezone('America/New_York', now()))::date
  AND COALESCE(s.max_participants, 0) > 2
ORDER BY s.scheduled_datetime;

-- APPLY — set max to 2
UPDATE public.sessions s
SET max_participants = 2
WHERE s.session_type = '2-athlete'
  AND s.status IS DISTINCT FROM 'cancelled'
  AND (timezone('America/New_York', s.scheduled_datetime))::date
      = (timezone('America/New_York', now()))::date
  AND COALESCE(s.max_participants, 0) > 2
RETURNING
  s.id,
  s.scheduled_datetime,
  s.session_type,
  s.max_participants,
  s.current_participants;
