-- Backfill average_rating for athletes who have reviews (review_count was backfilled in 202401631; average_rating was not)
UPDATE public.athletes a
SET average_rating = (
  SELECT COALESCE(AVG(r.rating), 0)
  FROM public.reviews r
  WHERE r.athlete_id = a.id
)
WHERE EXISTS (SELECT 1 FROM public.reviews r WHERE r.athlete_id = a.id);
