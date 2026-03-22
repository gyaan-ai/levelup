-- One-off repair: parent paid in Stripe but webhook failed before roster row existed.
-- Source: checkout.session.completed metadata (Mar 21, 2026) — session Sabino / Ryan Thompson.
--
-- Run in Supabase SQL Editor (production). If your IDs differ, query first:
--   SELECT id, first_name, last_name FROM youth_wrestlers WHERE last_name ILIKE '%thompson%';
--   SELECT id, max_participants, current_participants FROM sessions WHERE id = '...';

BEGIN;

-- IDs from Stripe Checkout metadata (Mar 21, 2026). Edit literals if your DB differs.
-- If INSERT inserts 0 rows, the youth_wrestler UUID is missing — fix IDs and re-run.

INSERT INTO public.session_participants (
  session_id,
  youth_wrestler_id,
  parent_id,
  paid,
  amount_paid,
  roster_first_name,
  roster_last_name,
  roster_photo_url
)
SELECT
  '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85'::uuid,
  yw.id,
  'dc8ce6e2-d5fb-4658-a2b0-20aedb3fbf03'::uuid,
  true,
  30.00,
  yw.first_name,
  yw.last_name,
  yw.photo_url
FROM public.youth_wrestlers yw
WHERE yw.id = 'd2f3a1b5-c95f-4def-8b77-198ddf7cb457'::uuid
ON CONFLICT (session_id, youth_wrestler_id) DO UPDATE SET
  paid = true,
  amount_paid = EXCLUDED.amount_paid,
  roster_first_name = COALESCE(EXCLUDED.roster_first_name, session_participants.roster_first_name),
  roster_last_name = COALESCE(EXCLUDED.roster_last_name, session_participants.roster_last_name),
  roster_photo_url = COALESCE(EXCLUDED.roster_photo_url, session_participants.roster_photo_url);

-- Sync denormalized count so UI shows 6/6 (or N/N from actual roster rows)
UPDATE public.sessions s
SET
  current_participants = sub.cnt,
  updated_at = now()
FROM (
  SELECT session_id, COUNT(*)::int AS cnt
  FROM public.session_participants
  WHERE session_id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85'::uuid
  GROUP BY session_id
) sub
WHERE s.id = sub.session_id
  AND s.id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85'::uuid;

-- If the UI still shows the wrong cap (e.g. 6/5), align max with your product intent:
-- UPDATE public.sessions SET max_participants = 6 WHERE id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85'::uuid;

COMMIT;

-- Optional: verify
-- SELECT COUNT(*) FROM session_participants WHERE session_id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85';
-- SELECT current_participants, max_participants FROM sessions WHERE id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85';
