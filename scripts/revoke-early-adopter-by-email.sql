-- Revoke early adopter benefits for a parent so they can re-register with a new code (e.g. family 10% off).
-- Replace the email below with the parent's account email (e.g. Shuster mom).

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

  RAISE NOTICE 'Revoked early adopter for user % (% rows deleted). They can now sign up again with a new code (e.g. FAMILY10).', v_parent_id, v_deleted;
END $$;
