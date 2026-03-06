-- Add parent & wrestler fields to early access signups.
ALTER TABLE public.early_access
  ADD COLUMN IF NOT EXISTS parent_name TEXT,
  ADD COLUMN IF NOT EXISTS wrestler_name TEXT,
  ADD COLUMN IF NOT EXISTS school_club TEXT,
  ADD COLUMN IF NOT EXISTS graduation_year INTEGER,
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS parent_phone TEXT,
  ADD COLUMN IF NOT EXISTS weight_class TEXT,
  ADD COLUMN IF NOT EXISTS experience_level TEXT;

COMMENT ON COLUMN public.early_access.parent_name IS 'Parent/guardian full name';
COMMENT ON COLUMN public.early_access.wrestler_name IS 'Youth wrestler full name';
COMMENT ON COLUMN public.early_access.school_club IS 'School or club name';
COMMENT ON COLUMN public.early_access.graduation_year IS 'Expected high school graduation year (e.g. 2029)';
COMMENT ON COLUMN public.early_access.dob IS 'Wrestler date of birth';
COMMENT ON COLUMN public.early_access.parent_phone IS 'Parent cell phone';
COMMENT ON COLUMN public.early_access.weight_class IS 'Weight class';
COMMENT ON COLUMN public.early_access.experience_level IS 'Experience level (e.g. beginner, intermediate, advanced)';
