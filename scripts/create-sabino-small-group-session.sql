-- Clone Liam's *next upcoming* small-group session for Sabino Portella (same time, facility, focus, pricing).
-- Run in Supabase SQL Editor.
--
-- If this still fails, run the diagnostic at the bottom to see Liam's sessions, then either:
--   - Create/fix Liam's session in Admin, or
--   - Set v_source_session_id to a specific session UUID and re-run (see OPTIONAL block).

DO $$
DECLARE
  v_liam_athlete_id UUID;
  v_sabino_id UUID;
  v_new_session_id UUID;
  v_invite_code TEXT;
  v_liam_session RECORD;
  -- OPTIONAL: paste a session id to clone that row exactly (skips "find Liam's next session")
  v_source_session_id UUID := NULL;  -- e.g. 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
BEGIN
  -- 1) Liam (coach) — by account email from set-live-coaches-cam-liam-sabino.sql
  SELECT a.id INTO v_liam_athlete_id
  FROM public.athletes a
  JOIN public.users u ON u.id = a.id
  WHERE LOWER(TRIM(u.email)) = 'liampatrickhickey@gmail.com'
  LIMIT 1;

  IF v_liam_athlete_id IS NULL THEN
    RAISE EXCEPTION 'Liam not found: no athlete with users.email = liampatrickhickey@gmail.com';
  END IF;

  -- 2) Source session: explicit id OR next upcoming small group for Liam
  IF v_source_session_id IS NOT NULL THEN
    SELECT
      s.id,
      s.facility_id,
      s.scheduled_datetime,
      s.duration_minutes,
      s.session_type,
      s.session_mode,
      s.focus_area,
      s.join_policy,
      s.max_participants,
      s.base_price,
      s.price_per_participant,
      s.product_id,
      s.athlete_service_id
    INTO v_liam_session
    FROM public.sessions s
    WHERE s.id = v_source_session_id;
  ELSE
    SELECT
      s.id,
      s.facility_id,
      s.scheduled_datetime,
      s.duration_minutes,
      s.session_type,
      s.session_mode,
      s.focus_area,
      s.join_policy,
      s.max_participants,
      s.base_price,
      s.price_per_participant,
      s.product_id,
      s.athlete_service_id
    INTO v_liam_session
    FROM public.sessions s
    WHERE s.athlete_id = v_liam_athlete_id
      AND s.status IN ('scheduled', 'pending_payment')
      AND s.session_type IN ('group', 'small_group', '2-athlete')
      AND s.scheduled_datetime >= (NOW() AT TIME ZONE 'utc') - INTERVAL '1 hour'
    ORDER BY s.scheduled_datetime ASC
    LIMIT 1;
  END IF;

  IF v_liam_session.id IS NULL THEN
    RAISE EXCEPTION
      'No upcoming small group found for Liam (athlete_id=%). '
      'Set v_source_session_id to a session UUID to clone, or run the diagnostic SELECT at the bottom of this file.',
      v_liam_athlete_id;
  END IF;

  -- 3) Sabino Portella (coach)
  SELECT a.id INTO v_sabino_id
  FROM public.athletes a
  JOIN public.users u ON u.id = a.id
  WHERE LOWER(TRIM(u.email)) = 'sabinoportella@gmail.com'
  LIMIT 1;

  IF v_sabino_id IS NULL THEN
    RAISE EXCEPTION 'Sabino not found: no athlete with users.email = sabinoportella@gmail.com';
  END IF;

  -- 4) Unique invite code
  LOOP
    v_invite_code := upper(substring(md5(gen_random_uuid()::text || clock_timestamp()::text) from 1 for 8));
    IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE partner_invite_code = v_invite_code) THEN
      EXIT;
    END IF;
  END LOOP;

  -- 5) Insert: Sabino owns it; copy pricing/time/facility; start with 0 participants
  INSERT INTO public.sessions (
    parent_id,
    athlete_id,
    facility_id,
    session_type,
    session_mode,
    focus_area,
    join_policy,
    partner_invite_code,
    max_participants,
    current_participants,
    base_price,
    price_per_participant,
    product_id,
    athlete_service_id,
    scheduled_datetime,
    duration_minutes,
    total_price,
    athlete_payment,
    org_fee,
    stripe_fee,
    paid_with_credit,
    status,
    athlete_paid
  ) VALUES (
    v_sabino_id,
    v_sabino_id,
    v_liam_session.facility_id,
    COALESCE(v_liam_session.session_type, 'group'),
    COALESCE(v_liam_session.session_mode, 'partner-invite'),
    v_liam_session.focus_area,
    COALESCE(v_liam_session.join_policy, 'public'),
    v_invite_code,
    COALESCE(v_liam_session.max_participants, 6),
    0,
    v_liam_session.base_price,
    v_liam_session.price_per_participant,
    v_liam_session.product_id,
    v_liam_session.athlete_service_id,
    v_liam_session.scheduled_datetime,
    COALESCE(v_liam_session.duration_minutes, 60),
    0,
    0,
    0,
    0,
    false,
    'scheduled',
    false
  )
  RETURNING id INTO v_new_session_id;

  RAISE NOTICE 'Created session % for Sabino (cloned from Liam session %). Invite code: %',
    v_new_session_id, v_liam_session.id, v_invite_code;
END $$;

-- DIAGNOSTIC (run separately): Liam's recent/upcoming sessions
-- SELECT id, scheduled_datetime, session_type, session_mode, status, join_policy, max_participants, current_participants
-- FROM public.sessions
-- WHERE athlete_id = (SELECT id FROM public.athletes a JOIN public.users u ON u.id = a.id WHERE LOWER(u.email) = 'liampatrickhickey@gmail.com')
-- ORDER BY scheduled_datetime DESC
-- LIMIT 30;
