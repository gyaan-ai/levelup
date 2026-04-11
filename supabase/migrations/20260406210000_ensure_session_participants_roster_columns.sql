-- Idempotent: some production DBs never applied 20240322000001; app now inserts without
-- roster_* then backfills. Adding columns here ensures backfill succeeds and public roster UIs work.

ALTER TABLE public.session_participants
  ADD COLUMN IF NOT EXISTS roster_first_name TEXT,
  ADD COLUMN IF NOT EXISTS roster_last_name TEXT,
  ADD COLUMN IF NOT EXISTS roster_photo_url TEXT;

UPDATE public.session_participants sp
SET
  roster_first_name = COALESCE(sp.roster_first_name, yw.first_name),
  roster_last_name = COALESCE(sp.roster_last_name, yw.last_name),
  roster_photo_url = COALESCE(sp.roster_photo_url, yw.photo_url)
FROM public.youth_wrestlers yw
WHERE yw.id = sp.youth_wrestler_id
  AND sp.youth_wrestler_id IS NOT NULL;
