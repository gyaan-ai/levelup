-- Optional coach phone for SMS alerts (e.g. new signup to their session).
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.athletes.phone IS 'Coach mobile for SMS alerts (e.g. Twilio). E.164 preferred.';
