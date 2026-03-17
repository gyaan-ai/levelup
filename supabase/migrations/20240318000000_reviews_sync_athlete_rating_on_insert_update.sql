-- Ensure athlete average_rating and review_count stay in sync when reviews are inserted or updated.
-- (DELETE was already covered in 202401631; some DBs may be missing the INSERT/UPDATE trigger.)

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
      SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
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

-- Trigger for INSERT and UPDATE (idempotent: drop if exists then create)
DROP TRIGGER IF EXISTS update_athlete_rating_trigger ON public.reviews;
CREATE TRIGGER update_athlete_rating_trigger
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_athlete_rating();

-- Trigger for DELETE (ensure it exists)
DROP TRIGGER IF EXISTS update_athlete_rating_on_delete_trigger ON public.reviews;
CREATE TRIGGER update_athlete_rating_on_delete_trigger
  AFTER DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_athlete_rating();

-- Backfill all athletes who have reviews (fixes any that were missed by triggers)
UPDATE public.athletes a
SET
  average_rating = (
    SELECT COALESCE(ROUND(AVG(r.rating)::NUMERIC, 2), 0)
    FROM public.reviews r
    WHERE r.athlete_id = a.id
  ),
  review_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.reviews r
    WHERE r.athlete_id = a.id
  )
WHERE EXISTS (SELECT 1 FROM public.reviews r WHERE r.athlete_id = a.id);
