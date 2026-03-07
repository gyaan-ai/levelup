-- Break infinite recursion: youth_wrestlers policies check youth_wrestler_parents,
-- and youth_wrestler_parents policies check youth_wrestlers. Use a SECURITY DEFINER
-- function so the "is linked parent?" check reads youth_wrestler_parents without
-- triggering youth_wrestlers RLS.

CREATE OR REPLACE FUNCTION public.is_linked_parent(p_youth_wrestler_id uuid, p_parent_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.youth_wrestler_parents
    WHERE youth_wrestler_id = p_youth_wrestler_id AND parent_id = p_parent_id
  );
$$;

-- Recreate youth_wrestlers SELECT and UPDATE to use the function (no direct subquery to youth_wrestler_parents)
DROP POLICY IF EXISTS "Parents can view own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can view own youth wrestlers"
  ON public.youth_wrestlers FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.is_linked_parent(id, auth.uid()));

DROP POLICY IF EXISTS "Parents can update own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can update own youth wrestlers"
  ON public.youth_wrestlers FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR public.is_linked_parent(id, auth.uid()))
  WITH CHECK (true);
