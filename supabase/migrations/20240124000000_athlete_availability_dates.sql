-- Date-based availability: coaches add slots for specific dates (calendar) instead of day-of-week

CREATE TABLE IF NOT EXISTS public.athlete_availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(athlete_id, slot_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_athlete_availability_slots_athlete_date
  ON public.athlete_availability_slots(athlete_id, slot_date);

ALTER TABLE public.athlete_availability_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read athlete availability slots" ON public.athlete_availability_slots;
CREATE POLICY "Anyone can read athlete availability slots"
  ON public.athlete_availability_slots FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Athletes can manage own availability slots" ON public.athlete_availability_slots;
CREATE POLICY "Athletes can manage own availability slots"
  ON public.athlete_availability_slots FOR ALL
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Migrate existing recurring availability into date-specific slots for the next 12 weeks
INSERT INTO public.athlete_availability_slots (athlete_id, slot_date, start_time, end_time)
SELECT aa.athlete_id, d.d::date, aa.start_time, aa.end_time
FROM public.athlete_availability aa
CROSS JOIN LATERAL (
  SELECT generate_series(CURRENT_DATE, CURRENT_DATE + interval '84 days', '1 day')::date AS d
) d
WHERE EXTRACT(DOW FROM d.d) = aa.day_of_week
ON CONFLICT (athlete_id, slot_date, start_time) DO NOTHING;
