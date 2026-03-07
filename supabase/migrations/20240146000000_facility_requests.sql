-- Coaches can request a facility not on the list; admin approves or rejects.
-- On approve: create facility and assign to requesting coach.

CREATE TABLE IF NOT EXISTS public.facility_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  school TEXT NOT NULL,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_facility_requests_status ON public.facility_requests(status);
CREATE INDEX IF NOT EXISTS idx_facility_requests_athlete ON public.facility_requests(requested_by_athlete_id);

ALTER TABLE public.facility_requests ENABLE ROW LEVEL SECURITY;

-- Athletes can create requests for themselves only
CREATE POLICY "Athletes can insert own facility request"
  ON public.facility_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by_athlete_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'athlete')
  );

-- Athletes can read their own requests
CREATE POLICY "Athletes can select own facility requests"
  ON public.facility_requests FOR SELECT TO authenticated
  USING (requested_by_athlete_id = auth.uid());

-- Admins can select all (for admin dashboard)
CREATE POLICY "Admins can select all facility requests"
  ON public.facility_requests FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update (approve/reject)
CREATE POLICY "Admins can update facility requests"
  ON public.facility_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (true);

COMMENT ON TABLE public.facility_requests IS 'Coach-requested facilities pending admin approval. On approve, facility is created and coach is assigned.';
