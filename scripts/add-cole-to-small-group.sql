-- Add Cole to the small group session (Sunday Mar 15, 2026 11:00 AM, UNC).
-- Run this in Supabase SQL Editor. Finds the session by date/time, finds Cole by sibling Shane in the session.
--
-- If you get "Cole not found", run this first to list this parent's kids (use parent_id from the error):
--   SELECT id, first_name, last_name FROM youth_wrestlers
--   WHERE parent_id = '03d6216f-ec85-4f15-877c-e505aa5f544f' AND active = true
--   UNION
--   SELECT yw.id, yw.first_name, yw.last_name FROM youth_wrestlers yw
--   JOIN youth_wrestler_parents ywp ON ywp.youth_wrestler_id = yw.id
--   WHERE ywp.parent_id = '03d6216f-ec85-4f15-877c-e505aa5f544f' AND yw.active = true;
-- If Cole isn't in the list, the parent needs to add him in the app (My Wrestlers). Then re-run this script.

DO $$
DECLARE
  v_session_id UUID;
  v_parent_id UUID;
  v_cole_id UUID;
  v_current INT;
BEGIN
  -- Session: small group on 2026-03-15 around 11:00 AM (Eastern ~ 15:00–17:00 UTC)
  SELECT s.id, s.current_participants
  INTO v_session_id, v_current
  FROM public.sessions s
  WHERE s.scheduled_datetime >= '2026-03-15T15:00:00Z'
    AND s.scheduled_datetime < '2026-03-15T17:00:00Z'
    AND s.status IN ('scheduled', 'pending_payment')
    AND (s.session_type = 'small_group' OR s.session_type = 'group')
  ORDER BY s.scheduled_datetime
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found: no small group on 2026-03-15 ~11 AM. Check scheduled_datetime and session_type.';
  END IF;

  -- Parent: whoever has a kid (Shane) already in this session
  SELECT sp.parent_id INTO v_parent_id
  FROM public.session_participants sp
  WHERE sp.session_id = v_session_id
  LIMIT 1;

  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'No participant found for this session.';
  END IF;

  -- Cole: first try same parent as session (sibling), then any "Cole Shuster" in the app
  SELECT yw.id INTO v_cole_id
  FROM public.youth_wrestlers yw
  WHERE yw.active = true
    AND LOWER(TRIM(yw.first_name)) = 'cole'
    AND (
      yw.parent_id = v_parent_id
      OR EXISTS (SELECT 1 FROM public.youth_wrestler_parents ywp WHERE ywp.youth_wrestler_id = yw.id AND ywp.parent_id = v_parent_id)
    )
  LIMIT 1;

  IF v_cole_id IS NULL THEN
    -- Cole may be under a different parent (e.g. cheryl0320@gmail.com): find by first + last name
    SELECT yw.id, yw.parent_id INTO v_cole_id, v_parent_id
    FROM public.youth_wrestlers yw
    WHERE yw.active = true
      AND LOWER(TRIM(yw.first_name)) = 'cole'
      AND (yw.last_name IS NULL OR LOWER(TRIM(yw.last_name)) = 'shuster')
    LIMIT 1;
  END IF;

  IF v_cole_id IS NULL THEN
    RAISE EXCEPTION 'Cole not found. Tried: (1) Cole with same parent as session participant, (2) any youth_wrestler first_name Cole, last_name Shuster. Run LIST_KIDS query in script comment or use add-cole-by-id.sql.';
  END IF;

  -- Avoid duplicate
  IF EXISTS (SELECT 1 FROM public.session_participants WHERE session_id = v_session_id AND youth_wrestler_id = v_cole_id) THEN
    RAISE NOTICE 'Cole is already in this session. No change.';
    RETURN;
  END IF;

  INSERT INTO public.session_participants (session_id, youth_wrestler_id, parent_id, paid, amount_paid)
  VALUES (v_session_id, v_cole_id, v_parent_id, true, 0);

  UPDATE public.sessions
  SET current_participants = COALESCE(v_current, 1) + 1,
      updated_at = NOW()
  WHERE id = v_session_id;

  RAISE NOTICE 'Added Cole (youth_wrestler_id %) to session %.', v_cole_id, v_session_id;
END $$;
