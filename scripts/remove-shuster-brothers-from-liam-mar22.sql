-- Remove Cole Shuster and Shane Shuster from Liam's small group (join code Z8MQDWSL).
-- Run this in Supabase SQL editor. After: decrement current_participants and delete their session_participants rows.

DO $$
DECLARE
  v_session_id UUID;
  v_yw_ids UUID[];
  v_deleted INT;
  v_current INT;
BEGIN
  SELECT id INTO v_session_id
  FROM public.sessions
  WHERE partner_invite_code = 'Z8MQDWSL'
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Session with invite code Z8MQDWSL not found';
  END IF;

  SELECT ARRAY_AGG(id) INTO v_yw_ids
  FROM public.youth_wrestlers
  WHERE last_name ILIKE 'Shuster'
    AND first_name IN ('Cole', 'Shane');

  IF v_yw_ids IS NULL OR array_length(v_yw_ids, 1) IS NULL THEN
    RAISE NOTICE 'No youth wrestlers found for Cole/Shane Shuster';
    RETURN;
  END IF;

  DELETE FROM public.session_participants
  WHERE session_id = v_session_id
    AND youth_wrestler_id = ANY(v_yw_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  SELECT current_participants INTO v_current
  FROM public.sessions WHERE id = v_session_id;

  UPDATE public.sessions
  SET current_participants = GREATEST(0, (v_current - v_deleted)),
      updated_at = NOW()
  WHERE id = v_session_id;

  RAISE NOTICE 'Removed % Shuster participant(s) from session %. New current_participants: %', v_deleted, v_session_id, GREATEST(0, v_current - v_deleted);
END $$;
