-- =============================================================================
-- Link an extra parent to a youth wrestler (same as POST .../link-parent API)
-- Run in Supabase SQL Editor (postgres role bypasses RLS).
--
-- Preconditions:
--   • public.users must have a row for the parent email (sign in to the app once with that account).
--   • Kid name must match youth_wrestlers.first_name / last_name (spelling). If multiple matches, set override.
--
-- Edit the three strings in DECLARE below before running.
-- =============================================================================

DO $$
DECLARE
  v_parent_email TEXT := '';
  v_kid_first TEXT := '';
  v_kid_last TEXT := '';
  v_kid_id_override UUID := NULL;

  v_parent_id UUID;
  v_youth_wrestler_id UUID;
  v_primary UUID;
  v_inserted INT;
  v_n INT;
BEGIN
  IF v_parent_email IS NULL OR trim(v_parent_email) = '' THEN
    RAISE EXCEPTION 'Set v_parent_email to the linked parent''s email (must exist in public.users).';
  END IF;

  SELECT u.id
  INTO v_parent_id
  FROM public.users u
  WHERE lower(trim(u.email)) = lower(trim(v_parent_email));

  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'No public.users row for email %', v_parent_email;
  END IF;

  IF v_kid_id_override IS NOT NULL AND v_kid_id_override <> '00000000-0000-0000-0000-000000000000'::uuid THEN
    SELECT y.id INTO v_youth_wrestler_id
    FROM public.youth_wrestlers y
    WHERE y.id = v_kid_id_override;
    IF v_youth_wrestler_id IS NULL THEN
      RAISE EXCEPTION 'No youth_wrestlers row for v_kid_id_override %', v_kid_id_override;
    END IF;
  ELSE
    IF v_kid_first IS NULL OR trim(v_kid_first) = '' OR v_kid_last IS NULL OR trim(v_kid_last) = '' THEN
      RAISE EXCEPTION 'Set v_kid_first and v_kid_last to the kid''s name, or set v_kid_id_override to their youth_wrestlers.id.';
    END IF;

    SELECT count(*)::INT INTO v_n
    FROM public.youth_wrestlers y
    WHERE lower(trim(y.first_name)) = lower(trim(v_kid_first))
      AND lower(trim(y.last_name)) = lower(trim(v_kid_last));

    IF v_n = 0 THEN
      RAISE EXCEPTION 'No youth_wrestlers row for name % %', v_kid_first, v_kid_last;
    END IF;

    IF v_n > 1 THEN
      RAISE EXCEPTION
        'Multiple youth_wrestlers (count=%) for name "% %". Use the debug SELECT at the bottom of this script to pick id, then set v_kid_id_override.',
        v_n, v_kid_first, v_kid_last;
    END IF;

    SELECT y.id INTO v_youth_wrestler_id
    FROM public.youth_wrestlers y
    WHERE lower(trim(y.first_name)) = lower(trim(v_kid_first))
      AND lower(trim(y.last_name)) = lower(trim(v_kid_last))
    LIMIT 1;
  END IF;

  RAISE NOTICE 'Resolved: parent_id=%, youth_wrestler_id=%', v_parent_id, v_youth_wrestler_id;

  SELECT y.parent_id INTO v_primary FROM public.youth_wrestlers y WHERE y.id = v_youth_wrestler_id;
  IF v_primary = v_parent_id THEN
    RAISE NOTICE 'That user is already the PRIMARY parent (youth_wrestlers.parent_id). No row needed in youth_wrestler_parents.';
    RETURN;
  END IF;

  INSERT INTO public.youth_wrestler_parents (youth_wrestler_id, parent_id)
  VALUES (v_youth_wrestler_id, v_parent_id)
  ON CONFLICT (youth_wrestler_id, parent_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RAISE NOTICE 'Already linked (unique pair exists).';
  ELSE
    RAISE NOTICE 'Linked parent % to youth wrestler %.', v_parent_id, v_youth_wrestler_id;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Manual UUID mode (optional): insert when you already have both ids
-- -----------------------------------------------------------------------------
-- INSERT INTO public.youth_wrestler_parents (youth_wrestler_id, parent_id)
-- VALUES ('KID-UUID'::uuid, 'PARENT-UUID'::uuid)
-- ON CONFLICT (youth_wrestler_id, parent_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Debug: list kids matching a name (use when script says "multiple rows")
-- -----------------------------------------------------------------------------
-- SELECT id, first_name, last_name, parent_id, created_at
-- FROM public.youth_wrestlers
-- WHERE lower(trim(first_name)) = lower(trim('First'))
--   AND lower(trim(last_name)) = lower(trim('Last'));
