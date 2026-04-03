-- =============================================================================
-- Revoke parent_percentage_discounts — BY PARENT UUID (no email match needed)
-- Use when you copied parent_id from STEP 0 / youth_wrestlers / admin.
-- Replace ONLY the UUID on the next line, then run from DO through $$;
-- =============================================================================

DO $$
DECLARE
  v_parent_id UUID := '00000000-0000-0000-0000-000000000000'::uuid;
  v_deleted INT;
BEGIN
  IF v_parent_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Edit this script: set v_parent_id to the real UUID from auth.users or youth_wrestlers.parent_id.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_parent_id) THEN
    RAISE EXCEPTION 'No auth.users row for that id — wrong UUID or wrong project.';
  END IF;

  DELETE FROM public.parent_percentage_discounts WHERE parent_id = v_parent_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'Removed % row(s) for parent_id %', v_deleted, v_parent_id;
END $$;
