-- Cell phone for each youth wrestler (parent-provided). Used for coach ↔ athlete SMS and in-app contact.
ALTER TABLE public.youth_wrestlers
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.youth_wrestlers.phone IS 'Athlete cell (parent-supplied). Required for new profiles; used for coach messaging.';

-- Best-effort backfill from primary parent account so existing rows stay usable
UPDATE public.youth_wrestlers yw
SET phone = NULLIF(TRIM(u.phone), '')
FROM public.users u
WHERE yw.parent_id = u.id
  AND u.phone IS NOT NULL
  AND TRIM(u.phone) <> ''
  AND (yw.phone IS NULL OR TRIM(yw.phone) = '');
