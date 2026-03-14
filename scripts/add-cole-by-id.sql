-- Add a specific youth wrestler (e.g. Cole) to the small group by their youth_wrestler id.
-- Use when "Cole" wasn't found by name (different spelling or add after listing kids).
-- Replace the two UUIDs below with: (1) session_id, (2) youth_wrestler_id (Cole's id from youth_wrestlers).

DO $$
DECLARE
  v_session_id UUID := '00000000-0000-0000-0000-000000000000';  -- TODO: paste session id
  v_youth_wrestler_id UUID := '00000000-0000-0000-0000-000000000000';  -- TODO: paste Cole's youth_wrestler id
  v_parent_id UUID;
  v_current INT;
BEGIN
  IF v_session_id = '00000000-0000-0000-0000-000000000000' OR v_youth_wrestler_id = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Replace v_session_id and v_youth_wrestler_id in the script with real UUIDs.';
  END IF;

  SELECT parent_id INTO v_parent_id FROM public.youth_wrestlers WHERE id = v_youth_wrestler_id;
  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Youth wrestler % not found.', v_youth_wrestler_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.session_participants WHERE session_id = v_session_id AND youth_wrestler_id = v_youth_wrestler_id) THEN
    RAISE NOTICE 'This wrestler is already in the session. No change.';
    RETURN;
  END IF;

  SELECT current_participants INTO v_current FROM public.sessions WHERE id = v_session_id;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Session % not found.', v_session_id;
  END IF;

  INSERT INTO public.session_participants (session_id, youth_wrestler_id, parent_id, paid, amount_paid)
  VALUES (v_session_id, v_youth_wrestler_id, v_parent_id, true, 0);

  UPDATE public.sessions
  SET current_participants = v_current + 1, updated_at = NOW()
  WHERE id = v_session_id;

  RAISE NOTICE 'Added youth_wrestler % to session %.', v_youth_wrestler_id, v_session_id;
END $$;
