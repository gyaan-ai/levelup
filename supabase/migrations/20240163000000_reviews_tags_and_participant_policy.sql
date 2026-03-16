-- Reviews: add optional tags (canned + free-form); allow session participants to leave reviews
-- Run after 20240119000000_reviews_anonymous.sql

-- Add tags: array of short strings e.g. 'Technique', 'Great with kids', 'Punctual'
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.reviews.tags IS 'Optional canned tags chosen by parent (e.g. Technique, Great with kids)';

-- Allow any parent who participated in the session to leave a review (not only session owner)
-- Drop existing insert policy and recreate with session_participants check
DROP POLICY IF EXISTS "Parents can create reviews for own sessions" ON public.reviews;

CREATE POLICY "Parents can create reviews for own sessions"
  ON public.reviews FOR INSERT
  WITH CHECK (
    parent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
        AND s.status = 'completed'
        AND (
          s.parent_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.session_participants sp
            WHERE sp.session_id = s.id AND sp.parent_id = auth.uid()
          )
        )
    )
  );

-- Allow parents to update their own review (e.g. typo or add comment later)
CREATE POLICY "Parents can update own reviews"
  ON public.reviews FOR UPDATE
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- Update anonymous view to include tags (for public coach profile)
DROP VIEW IF EXISTS public.reviews_anonymous;

CREATE VIEW public.reviews_anonymous AS
SELECT
  id,
  session_id,
  athlete_id,
  rating,
  comment,
  tags,
  created_at
FROM public.reviews;

GRANT SELECT ON public.reviews_anonymous TO authenticated;
GRANT SELECT ON public.reviews_anonymous TO anon;

COMMENT ON VIEW public.reviews_anonymous IS 'Reviews without parent identity - use for coach profiles and public display';
