-- Many-to-many: coaches ↔ facilities (for Training location filter and future multi-venue UX).
-- Backfilled from athletes.facility_id and athletes.secondary_facility_id for active coaches.

CREATE TABLE IF NOT EXISTS public.coach_facilities (
  coach_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (coach_id, facility_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_facilities_facility_id ON public.coach_facilities(facility_id);
CREATE INDEX IF NOT EXISTS idx_coach_facilities_coach_id ON public.coach_facilities(coach_id);

COMMENT ON TABLE public.coach_facilities IS 'Facilities where a coach trains; used for parent Training filters and discovery.';

ALTER TABLE public.coach_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view coach_facilities"
  ON public.coach_facilities FOR SELECT
  USING (true);

INSERT INTO public.coach_facilities (coach_id, facility_id)
SELECT a.id, a.facility_id
FROM public.athletes a
WHERE a.facility_id IS NOT NULL
  AND a.active = TRUE
  AND (a.status IS NULL OR a.status = 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.coach_facilities (coach_id, facility_id)
SELECT a.id, a.secondary_facility_id
FROM public.athletes a
WHERE a.secondary_facility_id IS NOT NULL
  AND a.active = TRUE
  AND (a.status IS NULL OR a.status = 'active')
ON CONFLICT DO NOTHING;
