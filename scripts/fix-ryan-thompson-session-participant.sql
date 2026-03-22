-- One-off repair: parent paid in Stripe but webhook failed before roster row existed.
-- Source: checkout.session.metadata (Mar 21, 2026) — session Sabino / Ryan Thompson.
--
-- Uses only columns that exist on the base session_participants table (no roster_* columns).
-- If your DB has roster_first_name / roster_last_name / roster_photo_url, apply migration
--   supabase/migrations/20240322000001_session_participants_roster_display.sql
-- and you can extend this INSERT with those columns if you want public roster names.
--
-- Run in Supabase SQL Editor. If IDs differ, query:
--   SELECT id, first_name, last_name FROM youth_wrestlers WHERE last_name ILIKE '%thompson%';

BEGIN;

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

-- Sync denormalized count (6/6 when six roster rows exist)
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

-- If cap is wrong in UI (e.g. 6/5):
-- UPDATE public.sessions SET max_participants = 6 WHERE id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85'::uuid;

COMMIT;

-- Optional: verify
-- SELECT COUNT(*) FROM session_participants WHERE session_id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85';
-- SELECT current_participants, max_participants FROM sessions WHERE id = '5dd3b81a-f9dd-4054-8fe1-bd8d6253eb85';
