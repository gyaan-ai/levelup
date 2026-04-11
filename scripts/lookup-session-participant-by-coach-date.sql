-- =============================================================================
-- Find session + participant rows (e.g. remove someone from a completed session)
-- Run in Supabase SQL Editor. Adjust coach last name and local date as needed.
-- =============================================================================

-- 1) Sessions matching coach + calendar day in America/New_York (Apr 6, 2026)
SELECT
  s.id AS session_id,
  s.scheduled_datetime,
  s.status,
  s.session_type,
  a.first_name || ' ' || a.last_name AS coach_name,
  f.name AS facility_name
FROM public.sessions s
JOIN public.athletes a ON a.id = s.athlete_id
LEFT JOIN public.facilities f ON f.id = s.facility_id
WHERE lower(a.last_name) = lower('O''Neill')
  AND (timezone('America/New_York', s.scheduled_datetime))::date = date '2026-04-06'
ORDER BY s.scheduled_datetime;

-- 2) Paste session_id from above, then find Josh’s participant row + wrestler id
-- SELECT sp.id AS participant_id, sp.stripe_payment_intent_id, sp.amount_paid,
--        yw.first_name, yw.last_name, sp.session_id
-- FROM public.session_participants sp
-- JOIN public.youth_wrestlers yw ON yw.id = sp.youth_wrestler_id
-- WHERE sp.session_id = 'PASTE_SESSION_UUID'::uuid
--   AND (lower(yw.last_name) = lower('Brezak') OR lower(yw.first_name) = lower('Josh'));

-- =============================================================================
-- Removal
-- • In the app: Admin → that session → Session Roster → Delete (only if no Stripe PI).
-- • If stripe_payment_intent_id IS NOT NULL: issue refund in Stripe first; then either
--   support clears the PI on the row and deletes, or you NULL the PI (ops only) and delete.
-- Manual delete after confirming PI handling:
--   DELETE FROM public.session_participants WHERE id = 'participant_uuid';
--   -- then fix sessions.current_participants or run sync from app / API.
-- =============================================================================
