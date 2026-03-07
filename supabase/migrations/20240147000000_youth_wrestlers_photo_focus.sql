-- Photo focal point: let parents position the crop so the kid's face stays visible in card thumbnails
ALTER TABLE public.youth_wrestlers
  ADD COLUMN IF NOT EXISTS photo_focus_x SMALLINT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS photo_focus_y SMALLINT DEFAULT 50;

COMMENT ON COLUMN public.youth_wrestlers.photo_focus_x IS 'Focal point X (0-100). Used as CSS object-position percentage so face stays in frame.';
COMMENT ON COLUMN public.youth_wrestlers.photo_focus_y IS 'Focal point Y (0-100). Used as CSS object-position percentage.';
