-- Focus area for small group / group sessions (e.g. Takedowns, Single leg set-ups, Escapes).
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS focus_area TEXT;

COMMENT ON COLUMN public.sessions.focus_area IS 'Training focus for group/small_group sessions: Takedowns, Single leg set-ups, Escapes, Leg riding, etc.';
