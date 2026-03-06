-- Allow athletes (coaches) to read session_participants for sessions they coach,
-- so they can see which youth wrestlers are in each session.
CREATE POLICY "Participants: athlete sees for own sessions"
  ON public.session_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id AND s.athlete_id = auth.uid()
    )
  );
