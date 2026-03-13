-- Allow coaches (session athlete_id) to see and respond to join requests for their sessions.
-- Parents (session parent_id) already can; coaches need the same for partner/small group sessions they run.

DROP POLICY IF EXISTS "Join requests: select own or for my session" ON public.session_join_requests;
CREATE POLICY "Join requests: select own or for my session"
  ON public.session_join_requests FOR SELECT
  TO authenticated
  USING (
    requesting_parent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.athlete_id = auth.uid())
  );

DROP POLICY IF EXISTS "Join requests: session parent can update (approve/decline)" ON public.session_join_requests;
CREATE POLICY "Join requests: session parent or coach can update (approve/decline)"
  ON public.session_join_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.athlete_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.athlete_id = auth.uid())
  );
