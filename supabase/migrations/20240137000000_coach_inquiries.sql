-- Basic messaging from parents (and coaches replying) to potential coaches — no session required.
CREATE TABLE IF NOT EXISTS public.coach_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT coach_inquiries_sender_is_party CHECK (
    sender_id = parent_id OR sender_id = athlete_id
  )
);

CREATE INDEX IF NOT EXISTS idx_coach_inquiries_thread ON public.coach_inquiries(parent_id, athlete_id);
CREATE INDEX IF NOT EXISTS idx_coach_inquiries_created ON public.coach_inquiries(parent_id, athlete_id, created_at DESC);

ALTER TABLE public.coach_inquiries ENABLE ROW LEVEL SECURITY;

-- Parent sees threads they're in; coach (athlete) sees threads they're in
CREATE POLICY "Coach inquiries: parent or athlete can select"
  ON public.coach_inquiries FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid() OR athlete_id = auth.uid());

-- Parent or athlete can insert only as themselves (sender_id = auth.uid())
CREATE POLICY "Coach inquiries: parent or athlete can insert"
  ON public.coach_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (
    (parent_id = auth.uid() OR athlete_id = auth.uid())
    AND sender_id = auth.uid()
  );

COMMENT ON TABLE public.coach_inquiries IS 'Pre-booking messages between parent and coach (athlete). One thread per (parent_id, athlete_id).';
