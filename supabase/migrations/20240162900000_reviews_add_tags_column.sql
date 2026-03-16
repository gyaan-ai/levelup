-- Add tags column to reviews first (required before 20240163000000 view update)
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.reviews.tags IS 'Optional canned tags chosen by parent (e.g. Technique, Great with kids)';
