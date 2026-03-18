-- Optional cell phone for parents (and other users). Used for contact display, SMS, etc.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.users.phone IS 'User cell phone (E.164 preferred). Optional.';
