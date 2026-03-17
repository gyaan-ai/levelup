-- Verify Leave feedback: session participants and parent/youth data
-- Run in Supabase SQL Editor (Dashboard → SQL Editor). Use this to confirm a parent
-- should be able to leave feedback (their kid is in the session and parent_id lines up).

-- 1) Completed sessions with Liam Hickey as coach (March 2026)
SELECT
  s.id AS session_id,
  s.scheduled_datetime,
  s.status,
  s.parent_id AS session_owner_user_id,
  (SELECT email FROM public.users WHERE id = s.parent_id) AS session_owner_email,
  (a.first_name || ' ' || a.last_name) AS coach_name
FROM public.sessions s
JOIN public.athletes a ON a.id = s.athlete_id
WHERE a.first_name ILIKE 'Liam' AND a.last_name ILIKE 'Hickey'
  AND s.status = 'completed'
  AND s.scheduled_datetime >= '2026-03-01' AND s.scheduled_datetime < '2026-04-01'
ORDER BY s.scheduled_datetime DESC;

-- 2) For a specific session: paste the session_id below and run. Shows every participant
--    and whether the row's parent_id matches the youth_wrestler's parent_id.
-- Replace the UUID with the session_id from step 1 (e.g. the March 15 one).
/*
SELECT
  sp.id AS participant_row_id,
  sp.parent_id AS row_parent_id,
  u.email AS row_parent_email,
  sp.youth_wrestler_id,
  (yw.first_name || ' ' || yw.last_name) AS youth_name,
  yw.parent_id AS youth_primary_parent_id,
  (SELECT email FROM public.users WHERE id = yw.parent_id) AS youth_primary_parent_email,
  CASE WHEN sp.parent_id = yw.parent_id THEN 'YES' ELSE 'MISMATCH' END AS row_parent_matches_youth_parent
FROM public.session_participants sp
LEFT JOIN public.users u ON u.id = sp.parent_id
LEFT JOIN public.youth_wrestlers yw ON yw.id = sp.youth_wrestler_id
WHERE sp.session_id = 'PASTE_SESSION_ID_HERE'
ORDER BY sp.parent_id, yw.last_name;
*/

-- 3) Same as (2) but for ALL completed Liam Hickey March 2026 sessions (no paste needed)
SELECT
  s.scheduled_datetime::date AS session_date,
  sp.parent_id AS row_parent_id,
  u.email AS row_parent_email,
  (yw.first_name || ' ' || yw.last_name) AS youth_name,
  yw.parent_id AS youth_primary_parent_id,
  (SELECT email FROM public.users up WHERE up.id = yw.parent_id) AS youth_primary_parent_email,
  CASE WHEN sp.parent_id = yw.parent_id THEN 'match' ELSE 'MISMATCH' END AS parent_match
FROM public.sessions s
JOIN public.athletes a ON a.id = s.athlete_id
JOIN public.session_participants sp ON sp.session_id = s.id
LEFT JOIN public.users u ON u.id = sp.parent_id
LEFT JOIN public.youth_wrestlers yw ON yw.id = sp.youth_wrestler_id
WHERE a.first_name ILIKE 'Liam' AND a.last_name ILIKE 'Hickey'
  AND s.status = 'completed'
  AND s.scheduled_datetime >= '2026-03-01' AND s.scheduled_datetime < '2026-04-01'
ORDER BY s.scheduled_datetime DESC, u.email, yw.last_name;

-- 4) Optional: find a parent by name or email (e.g. Shuster) and see their sessions
-- Uncomment and set the filter, then run.
/*
SELECT
  s.scheduled_datetime::date,
  s.status,
  (a.first_name || ' ' || a.last_name) AS coach,
  u.email AS parent_email,
  (yw.first_name || ' ' || yw.last_name) AS youth
FROM public.session_participants sp
JOIN public.sessions s ON s.id = sp.session_id
JOIN public.athletes a ON a.id = s.athlete_id
JOIN public.users u ON u.id = sp.parent_id
JOIN public.youth_wrestlers yw ON yw.id = sp.youth_wrestler_id
WHERE s.status = 'completed'
  AND (u.email ILIKE '%shuster%' OR yw.last_name ILIKE '%Shuster%')
ORDER BY s.scheduled_datetime DESC;
*/
