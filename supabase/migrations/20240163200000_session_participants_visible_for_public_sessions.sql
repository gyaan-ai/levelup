-- Parents browsing Training / Find sessions can see who else is signed up for public or invite_only sessions.
CREATE POLICY "Participants: readable for public or invite_only sessions"
  ON public.session_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id
      AND s.join_policy IN ('public', 'invite_only')
    )
  );

COMMENT ON POLICY "Participants: readable for public or invite_only sessions" ON public.session_participants IS
  'So parents can see who is signed up when browsing open sessions (Training tab, etc.).';
