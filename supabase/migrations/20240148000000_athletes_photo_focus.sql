-- Coach/athlete photo focal point so face isn't cut off in circular crop
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS photo_focus_x SMALLINT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS photo_focus_y SMALLINT DEFAULT 50;

COMMENT ON COLUMN public.athletes.photo_focus_x IS 'Focal point X (0-100). CSS object-position so face stays in frame.';
COMMENT ON COLUMN public.athletes.photo_focus_y IS 'Focal point Y (0-100).';
