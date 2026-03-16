-- Add review_count to athletes; keep it in sync with reviews (one place for rating + count)
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

COMMENT ON COLUMN public.athletes.review_count IS 'Number of reviews for this coach; kept in sync by trigger';

-- Replace the rating trigger to also set review_count (and handle DELETE)
CREATE OR REPLACE FUNCTION update_athlete_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.athlete_id;
  ELSE
    target_id := NEW.athlete_id;
  END IF;
  UPDATE public.athletes
  SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM public.reviews
      WHERE athlete_id = target_id
    ),
    review_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.reviews
      WHERE athlete_id = target_id
    )
  WHERE id = target_id;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure DELETE also updates athlete stats
DROP TRIGGER IF EXISTS update_athlete_rating_on_delete_trigger ON public.reviews;
CREATE TRIGGER update_athlete_rating_on_delete_trigger
  AFTER DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_athlete_rating();

-- Backfill existing athletes
UPDATE public.athletes a
SET review_count = (
  SELECT COUNT(*)::INTEGER
  FROM public.reviews r
  WHERE r.athlete_id = a.id
);
