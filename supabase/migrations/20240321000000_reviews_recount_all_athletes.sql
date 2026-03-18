-- Recalculate every coach's review_count and average_rating from reviews (fixes stale counts).
-- Also fix trigger: on UPDATE, if athlete_id changes, update BOTH old and new coach.

CREATE OR REPLACE FUNCTION public.update_athlete_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.athlete_id;
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
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.athlete_id IS DISTINCT FROM NEW.athlete_id THEN
    UPDATE public.athletes
    SET
      average_rating = (
        SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
        FROM public.reviews
        WHERE athlete_id = OLD.athlete_id
      ),
      review_count = (
        SELECT COUNT(*)::INTEGER
        FROM public.reviews
        WHERE athlete_id = OLD.athlete_id
      )
    WHERE id = OLD.athlete_id;
    UPDATE public.athletes
    SET
      average_rating = (
        SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
        FROM public.reviews
        WHERE athlete_id = NEW.athlete_id
      ),
      review_count = (
        SELECT COUNT(*)::INTEGER
        FROM public.reviews
        WHERE athlete_id = NEW.athlete_id
      )
    WHERE id = NEW.athlete_id;
    RETURN NEW;
  ELSE
    target_id := NEW.athlete_id;
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
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Full recount for every athlete (Liam and anyone else with drift)
UPDATE public.athletes a
SET
  average_rating = COALESCE((
    SELECT ROUND(AVG(r.rating)::NUMERIC, 2)
    FROM public.reviews r
    WHERE r.athlete_id = a.id
  ), 0),
  review_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.reviews r
    WHERE r.athlete_id = a.id
  );
