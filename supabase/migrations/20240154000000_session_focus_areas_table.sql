/* Admin-editable list of session topics (focus areas) for group/small_group sessions. */
CREATE TABLE IF NOT EXISTS public.session_focus_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.session_focus_areas IS 'Session topics for dropdown when creating/editing group sessions; editable in Admin.';

/* Seed with default list (matches lib/focus-areas.ts) */
INSERT INTO public.session_focus_areas (name, sort_order) VALUES
  ('Takedowns', 1),
  ('Single leg set-ups', 2),
  ('Double legs', 3),
  ('Escapes', 4),
  ('Leg riding', 5),
  ('Top control', 6),
  ('Bottom position', 7),
  ('Neutral', 8),
  ('Neutral Re-Attacks', 9),
  ('Finishing', 10),
  ('Hand fighting', 11),
  ('Other', 12)
ON CONFLICT (name) DO NOTHING;

/* RLS: allow read for authenticated; allow all for service role (admin API will use admin client) */
ALTER TABLE public.session_focus_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated"
  ON public.session_focus_areas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all for service role"
  ON public.session_focus_areas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
