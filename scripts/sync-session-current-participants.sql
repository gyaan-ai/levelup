-- Reconcile sessions.current_participants with COUNT(session_participants).
-- Run in Supabase SQL. Uncomment the AND line to scope to one session.

UPDATE public.sessions s
SET
  current_participants = sub.cnt,
  updated_at = now()
FROM (
  SELECT session_id, COUNT(*)::int AS cnt
  FROM public.session_participants
  GROUP BY session_id
) sub
WHERE s.id = sub.session_id
  -- AND s.id = '00000000-0000-0000-0000-000000000000'::uuid
  AND (s.current_participants IS DISTINCT FROM sub.cnt);
