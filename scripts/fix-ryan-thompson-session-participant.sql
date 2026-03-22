-- Paste ALL of this into Supabase SQL Editor and Run (single transaction optional).
-- If your error mentions roster_first_name, you pasted OLD text — re-copy from this file on main.

INSERT INTO public.session_participants (
  session_id,
  youth_wrestler_id,
  parent_id,
  paid,
  amount_paid
)
VALUES (
  '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85'::uuid,
  'd2f3a1b5-c95f-4def-8b77-198ddf7cb457'::uuid,
  'dc8ce6e2-d5fb-4658-a2b0-20aedb3fbf03'::uuid,
  true,
  30.00
)
ON CONFLICT (session_id, youth_wrestler_id) DO UPDATE SET
  paid = true,
  amount_paid = EXCLUDED.amount_paid;

UPDATE public.sessions AS s
SET
  current_participants = sub.cnt,
  updated_at = now()
FROM (
  SELECT session_id, COUNT(*)::int AS cnt
  FROM public.session_participants
  WHERE session_id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85'::uuid
  GROUP BY session_id
) AS sub
WHERE s.id = sub.session_id
  AND s.id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85'::uuid;
