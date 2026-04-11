-- Columns referenced by coach application signup (lib/coach-application-signup.ts).
-- Legacy schema used safesport_expiration / background_check_expiration / zelle_email;
-- these booleans + payout_method were added for the application form.

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS payout_method TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'athletes_payout_method_check'
  ) THEN
    ALTER TABLE public.athletes
      ADD CONSTRAINT athletes_payout_method_check
      CHECK (payout_method IS NULL OR payout_method IN ('venmo', 'zelle'));
  END IF;
END $$;

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS safesport_certified BOOLEAN DEFAULT FALSE;

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS background_check BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.athletes.payout_method IS 'Coach payout preference from application: venmo | zelle.';
COMMENT ON COLUMN public.athletes.safesport_certified IS 'Whether coach attested to SafeSport on application.';
COMMENT ON COLUMN public.athletes.background_check IS 'Whether coach attested to background check on application.';
