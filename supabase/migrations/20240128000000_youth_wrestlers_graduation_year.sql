-- Replace grade with graduation_year (e.g. 2029 = "Class of 2029"). No yearly updates needed.
ALTER TABLE public.youth_wrestlers
  ADD COLUMN IF NOT EXISTS graduation_year SMALLINT;

-- Remove old column (drops existing grade data; no backfill)
ALTER TABLE public.youth_wrestlers
  DROP COLUMN IF EXISTS grade;

COMMENT ON COLUMN public.youth_wrestlers.graduation_year IS 'High school graduation year, e.g. 2029 for Class of 2029';
