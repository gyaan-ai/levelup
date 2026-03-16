-- Add Luke Padgett to Sabino's small group session (Sunday Mar 15, 2026 11:00 AM).
-- Run this in Supabase SQL Editor.
--
-- If you get "Luke Padgett not found", list youth wrestlers named Luke:
--   SELECT id, first_name, last_name, parent_id FROM youth_wrestlers
--   WHERE active = true AND LOWER(TRIM(first_name)) = 'luke';
-- If Luke isn't there, the parent needs to add him in the app (My Wrestlers). Then re-run.

DO $$
DECLARE
  v_sabino_id UUID;
  v_session_id UUID;
  v_luke_id UUID;
  v_parent_id UUID;
  v_current INT;
BEGIN
  -- Sabino Portella (coach)
  SELECT a.id INTO v_sabino_id
  FROM public.athletes a
  WHERE LOWER(TRIM(a.first_name)) = 'sabino'
    AND LOWER(TRIM(a.last_name)) = 'portella'
  LIMIT 1;

  IF v_sabino_id IS NULL THEN
    RAISE EXCEPTION 'Sabino Portella not found in athletes.';
  END IF;

  -- Session: Sabino's small group tomorrow 11:00 AM Eastern (~ 15:00–17:00 UTC)
  SELECT s.id, s.current_participants
  INTO v_session_id, v_current
  FROM public.sessions s
  WHERE s.athlete_id = v_sabino_id
    AND s.scheduled_datetime >= '2026-03-15T15:00:00Z'
    AND s.scheduled_datetime < '2026-03-15T17:00:00Z'
    AND s.status IN ('scheduled', 'pending_payment')
    AND (s.session_type = 'small_group' OR s.session_type = 'group')
  ORDER BY s.scheduled_datetime
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found: Sabino small group on 2026-03-15 ~11 AM. Check scheduled_datetime and athlete_id.';
  END IF;

  -- Luke Padgett (youth wrestler + parent for session_participants)
  SELECT yw.id, yw.parent_id INTO v_luke_id, v_parent_id
  FROM public.youth_wrestlers yw
  WHERE yw.active = true
    AND LOWER(TRIM(yw.first_name)) = 'luke'
    AND (yw.last_name IS NULL OR LOWER(TRIM(yw.last_name)) = 'padgett')
  LIMIT 1;

  IF v_luke_id IS NULL THEN
    RAISE EXCEPTION 'Luke Padgett not found. Add him in the app (My Wrestlers) or check first_name/last_name spelling.';
  END IF;

  -- parent_id required for session_participants; use linked parent if Luke has one
  IF v_parent_id IS NULL THEN
    SELECT ywp.parent_id INTO v_parent_id
    FROM public.youth_wrestler_parents ywp
    WHERE ywp.youth_wrestler_id = v_luke_id
    LIMIT 1;
  END IF;
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Luke Padgett has no parent_id and no linked parent. Link a parent in the app or set youth_wrestlers.parent_id.';
  END IF;

  -- Avoid duplicate
  IF EXISTS (SELECT 1 FROM public.session_participants WHERE session_id = v_session_id AND youth_wrestler_id = v_luke_id) THEN
    RAISE NOTICE 'Luke Padgett is already in this session. No change.';
    RETURN;
  END IF;

  INSERT INTO public.session_participants (session_id, youth_wrestler_id, parent_id, paid, amount_paid)
  VALUES (v_session_id, v_luke_id, v_parent_id, true, 0);

  UPDATE public.sessions
  SET current_participants = COALESCE(v_current, 0) + 1,
      updated_at = NOW()
  WHERE id = v_session_id;

  RAISE NOTICE 'Added Luke Padgett (youth_wrestler_id %) to Sabino session %.', v_luke_id, v_session_id;
END $$;
