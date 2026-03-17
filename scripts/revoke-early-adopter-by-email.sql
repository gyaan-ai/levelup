-- Revoke GUILDLAUNCH (early adopter) benefits for a parent so 100% off stops applying.
-- Run in Supabase SQL editor. Replace the email with the parent's account (e.g. Shuster mom).
-- After this, they pay for sessions; use FAMILY10 for 10% off.

DO $$
DECLARE
  v_parent_id UUID;
  v_deleted INT;
BEGIN
  SELECT id INTO v_parent_id
  FROM public.users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM('REPLACE_WITH_PARENT_EMAIL@example.com'));

  IF v_parent_id IS NULL THEN
    RAISE NOTICE 'No user found with that email. Check the address.';
    RETURN;
  END IF;

  DELETE FROM public.early_adopter_entitlements
  WHERE parent_id = v_parent_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'Revoked early adopter (GUILDLAUNCH) for user % (% rows deleted). They now pay for sessions; FAMILY10 still applies 10%% off if they have it.', v_parent_id, v_deleted;
END $$;
