-- Coach application (and other APIs) insert first_name / last_name on public.users.
-- These columns were missing from the initial schema; add them for production parity.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

COMMENT ON COLUMN public.users.first_name IS 'Display name (optional for legacy rows; set on signup / coach application).';
COMMENT ON COLUMN public.users.last_name IS 'Display name (optional for legacy rows; set on signup / coach application).';

-- Backfill from coach profiles where the user row predates these columns.
UPDATE public.users u
SET
  first_name = COALESCE(NULLIF(TRIM(u.first_name), ''), a.first_name),
  last_name = COALESCE(NULLIF(TRIM(u.last_name), ''), a.last_name)
FROM public.athletes a
WHERE a.id = u.id
  AND (u.first_name IS NULL OR TRIM(u.first_name) = '' OR u.last_name IS NULL OR TRIM(u.last_name) = '');
