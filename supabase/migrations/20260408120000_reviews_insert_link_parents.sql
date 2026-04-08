-- Reviews INSERT RLS: allow primary parent on youth_wrestler row and linked parents (youth_wrestler_parents),
-- not only session organizer and session_participants.parent_id. Matches app/api/reviews/route.ts eligibility.

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
          OR EXISTS (
            SELECT 1 FROM public.session_participants sp
            INNER JOIN public.youth_wrestlers yw ON yw.id = sp.youth_wrestler_id
            WHERE sp.session_id = s.id AND yw.parent_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.session_participants sp
            INNER JOIN public.youth_wrestler_parents ywp ON ywp.youth_wrestler_id = sp.youth_wrestler_id
            WHERE sp.session_id = s.id AND ywp.parent_id = auth.uid()
          )
        )
    )
  );
