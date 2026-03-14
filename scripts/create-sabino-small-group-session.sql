-- Create a small group session for Sabino Portella (same time, location, focus, etc. as Liam's).
-- Run in Supabase SQL Editor. Uses the same criteria as add-cole-to-small-group.sql to find Liam's session.

DO $$
DECLARE
  v_liam_session RECORD;
  v_sabino_id UUID;
  v_new_session_id UUID;
  v_invite_code TEXT;
  v_done BOOLEAN := false;
BEGIN
  -- 1. Find Liam's small group: Sunday Mar 15, 2026 ~11:00 AM Eastern (15:00–17:00 UTC), UNC
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
  WHERE s.scheduled_datetime >= '2026-03-15T15:00:00Z'
    AND s.scheduled_datetime < '2026-03-15T17:00:00Z'
    AND s.status IN ('scheduled', 'pending_payment')
    AND (s.session_type = 'small_group' OR s.session_type = 'group')
  ORDER BY s.scheduled_datetime
  LIMIT 1;

  IF v_liam_session.id IS NULL THEN
    RAISE EXCEPTION 'Liam''s session not found: no small group on 2026-03-15 ~11 AM. Check scheduled_datetime and session_type.';
  END IF;

  -- 2. Find Sabino Portella (coach)
  SELECT a.id INTO v_sabino_id
  FROM public.athletes a
  WHERE LOWER(TRIM(a.first_name)) = 'sabino'
    AND LOWER(TRIM(a.last_name)) = 'portella'
  LIMIT 1;

  IF v_sabino_id IS NULL THEN
    RAISE EXCEPTION 'Sabino Portella not found in athletes. Check first_name / last_name.';
  END IF;

  -- 3. Generate unique partner_invite_code (for share/join link)
  LOOP
    v_invite_code := upper(substring(md5(gen_random_uuid()::text || clock_timestamp()::text) from 1 for 8));
    IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE partner_invite_code = v_invite_code) THEN
      EXIT;
    END IF;
  END LOOP;

  -- 4. Insert new session: same time, location, focus, pricing; coach = Sabino; no participants yet
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
    COALESCE(v_liam_session.join_policy, 'invite_only'),
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

  RAISE NOTICE 'Created session % for Sabino Portella (athlete_id %). Same time/location/focus as Liam''s. Share link code: %', v_new_session_id, v_sabino_id, v_invite_code;
END $$;
