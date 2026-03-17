-- Second focus area for small group sessions (e.g. "Takedowns, Escapes").
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS focus_area_2 TEXT;

COMMENT ON COLUMN public.sessions.focus_area_2 IS 'Optional second topic for group/small_group sessions; displayed with focus_area.';
