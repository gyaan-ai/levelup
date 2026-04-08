-- =============================================================================
-- Swap partner rosters: Liam Hickey session (Luke Richards + Gavin Hickey)
--   <-> Nick O'Neill session (Josh Brezak + Jake Amiott)
--
-- Run in Supabase SQL Editor as postgres (or role that bypasses RLS).
-- Uses one UPDATE so UNIQUE(session_id, youth_wrestler_id) stays valid.
--
-- Targets: Apr 7, 2026 at 6:00 PM US/Eastern (same wall time for both sessions).
-- Edit the date line if you reuse this for another year/day.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_liam_session uuid;
  v_nick_session uuid;
  session_day date := date '2026-04-07';
BEGIN
  SELECT s.id INTO v_liam_session
  FROM public.sessions s
  JOIN public.athletes a ON a.id = s.athlete_id
  WHERE (timezone('America/New_York', s.scheduled_datetime))::date = session_day
    AND EXTRACT(
      HOUR FROM (timezone('America/New_York', s.scheduled_datetime))::time
    ) = 18
    AND EXTRACT(
      MINUTE FROM (timezone('America/New_York', s.scheduled_datetime))::time
    ) BETWEEN 0 AND 5
    AND lower(a.first_name) = 'liam'
    AND lower(a.last_name) = 'hickey'
    AND (
      SELECT count(*)::int
      FROM public.session_participants sp
      JOIN public.youth_wrestlers yw ON yw.id = sp.youth_wrestler_id
      WHERE sp.session_id = s.id
        AND (
          (lower(trim(yw.first_name)) = 'gavin' AND lower(trim(yw.last_name)) = 'hickey')
          OR (lower(trim(yw.first_name)) = 'luke' AND lower(trim(yw.last_name)) = 'richards')
        )
    ) = 2
  ORDER BY s.scheduled_datetime
  LIMIT 1;

  SELECT s.id INTO v_nick_session
  FROM public.sessions s
  JOIN public.athletes a ON a.id = s.athlete_id
  WHERE (timezone('America/New_York', s.scheduled_datetime))::date = session_day
    AND EXTRACT(
      HOUR FROM (timezone('America/New_York', s.scheduled_datetime))::time
    ) = 18
    AND EXTRACT(
      MINUTE FROM (timezone('America/New_York', s.scheduled_datetime))::time
    ) BETWEEN 0 AND 5
    AND lower(a.first_name) = 'nick'
    AND lower(a.last_name) = 'o''neill'
    AND (
      SELECT count(*)::int
      FROM public.session_participants sp
      JOIN public.youth_wrestlers yw ON yw.id = sp.youth_wrestler_id
      WHERE sp.session_id = s.id
        AND (
          (lower(trim(yw.first_name)) = 'josh' AND lower(trim(yw.last_name)) IN ('brezak', 'brezac'))
          OR (lower(trim(yw.first_name)) = 'jake' AND lower(trim(yw.last_name)) = 'amiott')
        )
    ) = 2
  ORDER BY s.scheduled_datetime
  LIMIT 1;

  IF v_liam_session IS NULL THEN
    RAISE EXCEPTION 'Could not find Liam Hickey partner session on % ~6:00 PM Eastern with Gavin Hickey + Luke Richards.', session_day;
  END IF;
  IF v_nick_session IS NULL THEN
    RAISE EXCEPTION 'Could not find Nick O''Neill partner session on % ~6:00 PM Eastern with Josh Brezak + Jake Amiott.', session_day;
  END IF;
  IF v_liam_session = v_nick_session THEN
    RAISE EXCEPTION 'Same session id for both coaches — check data.';
  END IF;

  RAISE NOTICE 'Liam session %, Nick session %, day % 6:00 PM Eastern', v_liam_session, v_nick_session, session_day;

  UPDATE public.session_participants
  SET session_id = CASE session_id
    WHEN v_liam_session THEN v_nick_session
    WHEN v_nick_session THEN v_liam_session
  END
  WHERE session_id IN (v_liam_session, v_nick_session);

  UPDATE public.sessions
  SET
    current_participants = (
      SELECT count(*)::int FROM public.session_participants sp WHERE sp.session_id = sessions.id
    ),
    updated_at = NOW()
  WHERE id IN (v_liam_session, v_nick_session);

  RAISE NOTICE 'Swap done. Liam session now has Nick''s kids; Nick session now has Liam''s kids.';
END $$;

COMMIT;
