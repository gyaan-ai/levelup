-- Make reviews anonymous: coaches cannot see who left the review
-- Create a public-facing view that excludes parent_id

CREATE OR REPLACE VIEW public.reviews_anonymous AS
SELECT
  id,
  session_id,
  athlete_id,
  rating,
  comment,
  created_at
FROM public.reviews;

-- Grant access
GRANT SELECT ON public.reviews_anonymous TO authenticated;
GRANT SELECT ON public.reviews_anonymous TO anon;

-- RLS: use the view for reads by athletes/public; keep reviews table for parents to INSERT
-- The existing "Anyone can read reviews" policy on reviews table exposes parent_id.
-- Replace with: only allow SELECT on reviews for the parent who created it (their own reviews).
-- For public display (athlete profile, etc.) use reviews_anonymous instead.

-- Drop the broad read policy on reviews
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;

-- Parents can read their own reviews (for "my reviews" type features)
CREATE POLICY "Parents can read own reviews"
  ON public.reviews FOR SELECT
  USING (parent_id = auth.uid());

-- Admins can read all (for moderation)
CREATE POLICY "Admins can read all reviews"
  ON public.reviews FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON VIEW public.reviews_anonymous IS 'Reviews without parent identity - use for coach profiles and public display';
