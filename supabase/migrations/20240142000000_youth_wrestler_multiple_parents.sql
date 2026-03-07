-- Multiple parents per youth wrestler: link a second (or more) parent to the same kid.
-- youth_wrestlers.parent_id remains the "primary" parent; additional parents are in youth_wrestler_parents.

-- Primary parent must not be in this table (enforced by app: only "Add by email" / invite link add linked parents).
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

-- Primary parent can add/remove linked parents; linked parents can view and remove themselves
CREATE POLICY "youth_wrestler_parents_select"
  ON public.youth_wrestler_parents FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.youth_wrestlers y WHERE y.id = youth_wrestler_id AND y.parent_id = auth.uid())
  );

CREATE POLICY "youth_wrestler_parents_insert"
  ON public.youth_wrestler_parents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.youth_wrestlers y WHERE y.id = youth_wrestler_id AND y.parent_id = auth.uid())
  );

CREATE POLICY "youth_wrestler_parents_delete"
  ON public.youth_wrestler_parents FOR DELETE TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.youth_wrestlers y WHERE y.id = youth_wrestler_id AND y.parent_id = auth.uid())
  );

-- Youth wrestlers: a parent can see a kid if they are primary OR a linked parent
DROP POLICY IF EXISTS "Parents can view own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can view own youth wrestlers"
  ON public.youth_wrestlers FOR SELECT TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.youth_wrestler_parents yp WHERE yp.youth_wrestler_id = id AND yp.parent_id = auth.uid())
  );

-- Both primary and linked parents can update the kid's profile
DROP POLICY IF EXISTS "Parents can update own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can update own youth wrestlers"
  ON public.youth_wrestlers FOR UPDATE TO authenticated
  USING (
    parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.youth_wrestler_parents yp WHERE yp.youth_wrestler_id = id AND yp.parent_id = auth.uid())
  )
  WITH CHECK (true);

-- Only primary parent can delete the youth wrestler (keep parent_id unchanged on update)
DROP POLICY IF EXISTS "Parents can delete own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can delete own youth wrestlers"
  ON public.youth_wrestlers FOR DELETE TO authenticated
  USING (parent_id = auth.uid());

COMMENT ON TABLE public.youth_wrestler_parents IS 'Additional parents linked to a youth wrestler; youth_wrestlers.parent_id is the primary parent.';
