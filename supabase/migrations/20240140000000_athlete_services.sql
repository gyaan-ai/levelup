-- Coach-defined service offerings: duration, type (private/partner/small group), size, price.
-- Platform take 10%; coach receives 90% of parent_price.

CREATE TABLE IF NOT EXISTS public.athlete_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,

  -- Duration in minutes: 30, 60, 90, 120
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (30, 60, 90, 120)),

  -- Type: private (1), partner (2), small_group (3+)
  session_type TEXT NOT NULL CHECK (session_type IN ('private', 'partner', 'small_group')),

  -- For private=1, partner=2, small_group=3..20
  max_participants INTEGER NOT NULL CHECK (max_participants >= 1 AND max_participants <= 20),

  -- What parent pays per person (USD). Platform 10%, coach 90%.
  parent_price DECIMAL(10,2) NOT NULL CHECK (parent_price >= 0),
  athlete_payout DECIMAL(10,2) NOT NULL CHECK (athlete_payout >= 0),

  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT athlete_services_type_participants CHECK (
    (session_type = 'private' AND max_participants = 1) OR
    (session_type = 'partner' AND max_participants = 2) OR
    (session_type = 'small_group' AND max_participants >= 3)
  )
);

CREATE INDEX IF NOT EXISTS idx_athlete_services_athlete ON public.athlete_services(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_services_active ON public.athlete_services(athlete_id, active) WHERE active = true;

ALTER TABLE public.athlete_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Athletes can manage own services" ON public.athlete_services;
CREATE POLICY "Athletes can manage own services"
  ON public.athlete_services FOR ALL
  TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view active athlete services" ON public.athlete_services;
CREATE POLICY "Anyone can view active athlete services"
  ON public.athlete_services FOR SELECT
  TO authenticated
  USING (active = true);

DROP TRIGGER IF EXISTS update_athlete_services_updated_at ON public.athlete_services;
CREATE TRIGGER update_athlete_services_updated_at BEFORE UPDATE ON public.athlete_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.athlete_services IS 'Coach-built offerings: duration (30/60/90/120 min), type (private/partner/small_group), max participants, price. Platform 10%, coach 90%.';

-- Sessions can reference either a product (org) or an athlete_service (coach-built). Only run if sessions exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sessions') THEN
    ALTER TABLE public.sessions
      ADD COLUMN IF NOT EXISTS athlete_service_id UUID REFERENCES public.athlete_services(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_sessions_athlete_service ON public.sessions(athlete_service_id);
  END IF;
END $$;
