-- Per-booking messaging: parent <-> coach, one thread per session
CREATE TABLE IF NOT EXISTS public.booking_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_messages_session ON public.booking_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_booking_messages_created ON public.booking_messages(session_id, created_at);

ALTER TABLE public.booking_messages ENABLE ROW LEVEL SECURITY;

-- Only parent or coach for this session can read
CREATE POLICY "Booking messages: select if party"
  ON public.booking_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
        AND (s.parent_id = auth.uid() OR s.athlete_id = auth.uid())
    )
  );

-- Only parent or coach can send (and must be party to session)
CREATE POLICY "Booking messages: insert if party"
  ON public.booking_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_id
        AND (s.parent_id = auth.uid() OR s.athlete_id = auth.uid())
    )
  );
