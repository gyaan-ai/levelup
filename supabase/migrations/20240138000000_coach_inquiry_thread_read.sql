-- Track when each user last read each thread (for unread badge)
CREATE TABLE IF NOT EXISTS public.coach_inquiry_thread_read (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, parent_id, athlete_id),
  CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_athlete FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coach_inquiry_thread_read_user ON public.coach_inquiry_thread_read(user_id);

ALTER TABLE public.coach_inquiry_thread_read ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own read state"
  ON public.coach_inquiry_thread_read FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
