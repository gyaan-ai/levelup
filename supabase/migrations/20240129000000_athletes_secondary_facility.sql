-- Coaches can have a primary and optional secondary facility (global list).
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS secondary_facility_id UUID REFERENCES public.facilities(id);

COMMENT ON COLUMN public.athletes.secondary_facility_id IS 'Optional second location; facility_id remains primary.';
