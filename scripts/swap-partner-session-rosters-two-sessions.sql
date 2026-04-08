-- =============================================================================
-- Swap rosters between two partner sessions (e.g. last-minute coach/kid swap).
-- Moves every session_participants row on session A to B and vice versa in ONE
-- UPDATE so UNIQUE(session_id, youth_wrestler_id) never conflicts mid-flight.
--
-- Use for: "Liam's 2 kids" roster vs "Nick's 2 kids" roster on the same calendar day.
--
-- 1) Run STEP A only; confirm the two session IDs and kid names.
-- 2) Paste those UUIDs into STEP B and run in a transaction.
-- 3) Refresh admin / coach views.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP A — Discover sessions (edit date or coach names if needed)
-- -----------------------------------------------------------------------------
-- Calendar day in America/New_York; default Apr 7, 2026
SELECT
  s.id AS session_id,
  s.scheduled_datetime,
  s.status,
  s.session_type,
  s.session_mode,
  a.first_name || ' ' || a.last_name AS coach_name,
  sp.id AS participant_id,
  yw.first_name || ' ' || yw.last_name AS wrestler_name
FROM public.sessions s
JOIN public.athletes a ON a.id = s.athlete_id
LEFT JOIN public.session_participants sp ON sp.session_id = s.id
LEFT JOIN public.youth_wrestlers yw ON yw.id = sp.youth_wrestler_id
WHERE (timezone('America/New_York', s.scheduled_datetime))::date = date '2026-04-07'
  AND (
    (lower(a.first_name) = lower('Liam') AND lower(a.last_name) = lower('Hickey'))
    OR (lower(a.first_name) = lower('Nick') AND lower(a.last_name) = lower('O''Neill'))
  )
ORDER BY s.scheduled_datetime, coach_name, wrestler_name;

-- If multiple sessions per coach that day, narrow with scheduled time or add:
--   AND s.scheduled_datetime::time = '18:00:00'  -- example

-- -----------------------------------------------------------------------------
-- STEP B — Swap (set the two session UUIDs from STEP A, then run BEGIN…COMMIT)
-- -----------------------------------------------------------------------------
/*
BEGIN;

DO $$
DECLARE
  v_liam_session UUID := '00000000-0000-0000-0000-000000000000'; -- paste Liam coach session id
  v_nick_session UUID := '00000000-0000-0000-0000-000000000000'; -- paste Nick coach session id
  n_liam INT;
  n_nick INT;
BEGIN
  IF v_liam_session = '00000000-0000-0000-0000-000000000000'::uuid
     OR v_nick_session = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Set v_liam_session and v_nick_session from STEP A output.';
  END IF;

  SELECT count(*)::INT INTO n_liam FROM public.session_participants WHERE session_id = v_liam_session;
  SELECT count(*)::INT INTO n_nick FROM public.session_participants WHERE session_id = v_nick_session;
  RAISE NOTICE 'Before: Liam session % participants=%, Nick session % participants=%', v_liam_session, n_liam, v_nick_session, n_nick;

  UPDATE public.session_participants
  SET session_id = CASE session_id
    WHEN v_liam_session THEN v_nick_session
    WHEN v_nick_session THEN v_liam_session
  END
  WHERE session_id IN (v_liam_session, v_nick_session);

  UPDATE public.sessions
  SET
    current_participants = (
      SELECT count(*)::INT FROM public.session_participants sp WHERE sp.session_id = sessions.id
    ),
    updated_at = NOW()
  WHERE id IN (v_liam_session, v_nick_session);

  RAISE NOTICE 'Swap complete. Verify in Admin roster for both sessions.';
END $$;

COMMIT;
*/
