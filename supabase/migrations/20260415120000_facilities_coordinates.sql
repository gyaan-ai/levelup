-- Map: coach locator pins require stored coordinates (geocode on facility create/edit in admin).
ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_facilities_has_coordinates
  ON public.facilities (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN public.facilities.latitude IS 'WGS84 latitude; set via Mapbox geocoding or manual entry.';
COMMENT ON COLUMN public.facilities.longitude IS 'WGS84 longitude; set via Mapbox geocoding or manual entry.';
