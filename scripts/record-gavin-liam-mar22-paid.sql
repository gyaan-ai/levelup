-- One-off: Record Gavin (Matt Hickey – thehickeyclan@gmail.com) as paid $30 for Liam's Mar 22 2026 11:00 AM session.
-- Use when Stripe payment succeeded but the webhook didn't add the participant (e.g. webhook URL or secret wrong in production).
-- Run in Supabase SQL Editor.
--
-- Liam athlete_id = 094c9330-0cd5-4ff2-a83f-4c4ae9b0796a

-- Step 1: Insert participant (or update if already exists)
INSERT INTO public.session_participants (session_id, youth_wrestler_id, parent_id, paid, amount_paid)
SELECT
  s.id,
  yw.id,
  u.id,
  true,
  30.00
FROM (SELECT id FROM public.sessions WHERE athlete_id = '094c9330-0cd5-4ff2-a83f-4c4ae9b0796a' AND scheduled_datetime >= '2026-03-22 14:00:00+00' AND scheduled_datetime < '2026-03-22 17:00:00+00' ORDER BY scheduled_datetime LIMIT 1) s
CROSS JOIN (SELECT id FROM auth.users WHERE email = 'thehickeyclan@gmail.com' LIMIT 1) u
CROSS JOIN (SELECT id FROM public.youth_wrestlers WHERE parent_id = (SELECT id FROM auth.users WHERE email = 'thehickeyclan@gmail.com' LIMIT 1) AND first_name ILIKE 'Gavin' LIMIT 1) yw
ON CONFLICT (session_id, youth_wrestler_id) DO UPDATE
SET paid = true, amount_paid = 30.00;

-- Step 2: Recompute current_participants for that session (in case it was 0)
UPDATE public.sessions
SET current_participants = cnt.c,
    updated_at = now()
FROM (
  SELECT session_id, count(*) AS c
  FROM public.session_participants
  WHERE session_id IN (
    SELECT id FROM public.sessions
    WHERE athlete_id = '094c9330-0cd5-4ff2-a83f-4c4ae9b0796a'
      AND scheduled_datetime >= '2026-03-22 14:00:00+00'
      AND scheduled_datetime <  '2026-03-22 17:00:00+00'
  )
  GROUP BY session_id
) cnt
WHERE sessions.id = cnt.session_id;
