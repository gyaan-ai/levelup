-- Admin athlete density map (future): zip-level only, not shown publicly.
ALTER TABLE public.youth_wrestlers
  ADD COLUMN IF NOT EXISTS zip_code TEXT;

COMMENT ON COLUMN public.youth_wrestlers.zip_code IS 'Optional; used for admin density map (zip-level). Not shown on public profiles.';
