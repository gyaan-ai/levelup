-- Let parents (primary or linked) read any session where one of their youth wrestlers participated.
-- So both parents see the same schedule and billing for their kids (carpool, scheduling, etc.).
-- Ensure youth_wrestler_parents exists (in case 20240142000000_youth_wrestler_multiple_parents was not applied).
-- Table created without no_duplicate_primary CHECK (subqueries not allowed in CHECK). App prevents adding primary as linked parent.
CREATE TABLE IF NOT EXISTS public.youth_wrestler_parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youth_wrestler_id UUID NOT NULL REFERENCES public.youth_wrestlers(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(youth_wrestler_id, parent_id)
);
CREATE INDEX IF NOT EXISTS idx_youth_wrestler_parents_youth ON public.youth_wrestler_parents(youth_wrestler_id);
CREATE INDEX IF NOT EXISTS idx_youth_wrestler_parents_parent ON public.youth_wrestler_parents(parent_id);
ALTER TABLE public.youth_wrestler_parents ENABLE ROW LEVEL SECURITY;
-- Policies for youth_wrestler_parents (idempotent if 20240142 already ran)
DROP POLICY IF EXISTS "youth_wrestler_parents_select" ON public.youth_wrestler_parents;
CREATE POLICY "youth_wrestler_parents_select"
  ON public.youth_wrestler_parents FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.youth_wrestlers y WHERE y.id = youth_wrestler_id AND y.parent_id = auth.uid())
  );
DROP POLICY IF EXISTS "youth_wrestler_parents_insert" ON public.youth_wrestler_parents;
CREATE POLICY "youth_wrestler_parents_insert"
  ON public.youth_wrestler_parents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.youth_wrestlers y WHERE y.id = youth_wrestler_id AND y.parent_id = auth.uid())
  );
DROP POLICY IF EXISTS "youth_wrestler_parents_delete" ON public.youth_wrestler_parents;
CREATE POLICY "youth_wrestler_parents_delete"
  ON public.youth_wrestler_parents FOR DELETE TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.youth_wrestlers y WHERE y.id = youth_wrestler_id AND y.parent_id = auth.uid())
  );
-- Youth wrestlers policies that reference youth_wrestler_parents (idempotent)
DROP POLICY IF EXISTS "Parents can view own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can view own youth wrestlers"
  ON public.youth_wrestlers FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.youth_wrestler_parents yp WHERE yp.youth_wrestler_id = id AND yp.parent_id = auth.uid())
  );
DROP POLICY IF EXISTS "Parents can update own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can update own youth wrestlers"
  ON public.youth_wrestlers FOR UPDATE TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.youth_wrestler_parents yp WHERE yp.youth_wrestler_id = id AND yp.parent_id = auth.uid())
  )
  WITH CHECK (true);
DROP POLICY IF EXISTS "Parents can delete own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can delete own youth wrestlers"
  ON public.youth_wrestlers FOR DELETE TO authenticated
  USING (parent_id = auth.uid());
COMMENT ON TABLE public.youth_wrestler_parents IS 'Additional parents linked to a youth wrestler; youth_wrestlers.parent_id is the primary parent.';

-- Session participants: parent can read rows for their kids (so they can get session ids for family view)
DROP POLICY IF EXISTS "Participants: parent sees own" ON public.session_participants;
CREATE POLICY "Participants: parent sees own or for their kids"
  ON public.session_participants FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.youth_wrestlers yw WHERE yw.id = session_participants.youth_wrestler_id AND yw.parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.youth_wrestler_parents yp WHERE yp.youth_wrestler_id = session_participants.youth_wrestler_id AND yp.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "Parents can read own sessions" ON public.sessions;

CREATE POLICY "Parents can read own sessions or sessions for their kids"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid()
    OR athlete_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = sessions.id
      AND (
        EXISTS (
          SELECT 1 FROM public.youth_wrestlers yw
          WHERE yw.id = sp.youth_wrestler_id AND yw.parent_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.youth_wrestler_parents yp
          WHERE yp.youth_wrestler_id = sp.youth_wrestler_id AND yp.parent_id = auth.uid()
        )
      )
    )
  );

COMMENT ON POLICY "Parents can read own sessions or sessions for their kids" ON public.sessions IS
  'Parents see sessions they booked, or any session where a youth wrestler they parent (primary or linked) participated.';
