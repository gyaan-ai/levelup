-- Break infinite recursion: sessions SELECT policy reads session_participants,
-- and session_participants policies read sessions. Use a SECURITY DEFINER function
-- so the "can parent see this session via their kids?" check does not trigger RLS.

CREATE OR REPLACE FUNCTION public.session_visible_to_parent_via_kids(p_session_id uuid, p_parent_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = p_session_id
    AND (
      EXISTS (SELECT 1 FROM public.youth_wrestlers yw WHERE yw.id = sp.youth_wrestler_id AND yw.parent_id = p_parent_id)
      OR EXISTS (SELECT 1 FROM public.youth_wrestler_parents yp WHERE yp.youth_wrestler_id = sp.youth_wrestler_id AND yp.parent_id = p_parent_id)
    )
  );
$$;

-- Recreate the sessions SELECT policy to use the function instead of querying session_participants directly
DROP POLICY IF EXISTS "Parents can read own sessions or sessions for their kids" ON public.sessions;
CREATE POLICY "Parents can read own sessions or sessions for their kids"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid()
    OR athlete_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR public.session_visible_to_parent_via_kids(id, auth.uid())
  );

COMMENT ON FUNCTION public.session_visible_to_parent_via_kids(uuid, uuid) IS
  'Used by sessions RLS to avoid recursion: returns true if a parent (primary or linked) has a kid in this session.';
