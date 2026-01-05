-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'athlete', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Facilities table
CREATE TABLE public.facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  school TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Athletes table
CREATE TABLE public.athletes (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  school TEXT NOT NULL,
  facility_id UUID REFERENCES public.facilities(id),
  year TEXT CHECK (year IN ('Freshman', 'Sophomore', 'Junior', 'Senior', '5th Year')),
  weight_class TEXT,
  bio TEXT,
  photo_url TEXT,
  credentials JSONB DEFAULT '{}',
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  ytd_earnings DECIMAL(10,2) DEFAULT 0,
  commitment_sessions INTEGER DEFAULT 0,
  commitment_deadline DATE,
  commitment_fulfilled BOOLEAN DEFAULT FALSE,
  bank_account_id TEXT,
  stripe_account_id TEXT,
  usa_wrestling_expiration DATE,
  safesport_expiration DATE,
  background_check_expiration DATE,
  cpr_expiration DATE,
  certifications_verified BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id),
  session_type TEXT NOT NULL CHECK (session_type IN ('1-on-1', '2-athlete', 'group')),
  scheduled_datetime TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  total_price DECIMAL(10,2) NOT NULL,
  athlete_payment DECIMAL(10,2) NOT NULL,
  org_fee DECIMAL(10,2) NOT NULL,
  stripe_fee DECIMAL(10,2) NOT NULL,
  paid_with_credit BOOLEAN DEFAULT FALSE,
  credit_pool_id UUID,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
  athlete_paid BOOLEAN DEFAULT FALSE,
  athlete_payout_date DATE,
  stripe_payment_intent_id TEXT,
  stripe_payout_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit Pools table
CREATE TABLE public.credit_pools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pool_size INTEGER NOT NULL CHECK (pool_size IN (5, 10, 20)),
  credits_remaining INTEGER NOT NULL,
  total_credits INTEGER NOT NULL,
  purchase_price DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, parent_id)
);

-- Athlete Availability table
CREATE TABLE public.athlete_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(athlete_id, day_of_week, start_time)
);

-- Blocked Times table (for admin to block facility times)
CREATE TABLE public.blocked_times (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  blocked_start TIMESTAMPTZ NOT NULL,
  blocked_end TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_athletes_facility ON public.athletes(facility_id);
CREATE INDEX idx_athletes_active ON public.athletes(active);
CREATE INDEX idx_sessions_parent ON public.sessions(parent_id);
CREATE INDEX idx_sessions_athlete ON public.sessions(athlete_id);
CREATE INDEX idx_sessions_facility ON public.sessions(facility_id);
CREATE INDEX idx_sessions_status ON public.sessions(status);
CREATE INDEX idx_sessions_scheduled_datetime ON public.sessions(scheduled_datetime);
CREATE INDEX idx_credit_pools_parent ON public.credit_pools(parent_id);
CREATE INDEX idx_reviews_athlete ON public.reviews(athlete_id);
CREATE INDEX idx_athlete_availability_athlete ON public.athlete_availability(athlete_id);
CREATE INDEX idx_blocked_times_facility ON public.blocked_times(facility_id);
CREATE INDEX idx_blocked_times_dates ON public.blocked_times(blocked_start, blocked_end);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_athletes_updated_at BEFORE UPDATE ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_athlete_availability_updated_at BEFORE UPDATE ON public.athlete_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update athlete average rating
CREATE OR REPLACE FUNCTION update_athlete_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.athletes
  SET average_rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM public.reviews
    WHERE athlete_id = NEW.athlete_id
  )
  WHERE id = NEW.athlete_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update athlete rating when review is added/updated
CREATE TRIGGER update_athlete_rating_trigger
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_athlete_rating();

-- Function to update athlete total sessions
CREATE OR REPLACE FUNCTION update_athlete_sessions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.athletes
    SET total_sessions = total_sessions + 1
    WHERE id = NEW.athlete_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update athlete total sessions
CREATE TRIGGER update_athlete_sessions_trigger
  AFTER UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_athlete_sessions();

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;

-- Users: Users can read their own record, admins can read all
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Athletes: Public read access for active athletes, athletes can update their own profile
CREATE POLICY "Anyone can view active athletes"
  ON public.athletes FOR SELECT
  USING (active = true);

CREATE POLICY "Athletes can update own profile"
  ON public.athletes FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Athletes can insert own profile"
  ON public.athletes FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Facilities: Public read access
CREATE POLICY "Anyone can view facilities"
  ON public.facilities FOR SELECT
  USING (true);

-- Sessions: Parents can read their own sessions, athletes can read sessions they're in
CREATE POLICY "Parents can read own sessions"
  ON public.sessions FOR SELECT
  USING (
    parent_id = auth.uid() OR
    athlete_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Parents can create sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (
    parent_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'parent'
    )
  );

CREATE POLICY "Athletes can update own sessions"
  ON public.sessions FOR UPDATE
  USING (athlete_id = auth.uid());

-- Credit Pools: Parents can read and create their own pools
CREATE POLICY "Parents can read own credit pools"
  ON public.credit_pools FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can create credit pools"
  ON public.credit_pools FOR INSERT
  WITH CHECK (
    parent_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'parent'
    )
  );

-- Reviews: Parents can create reviews for their sessions, anyone can read reviews
CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Parents can create reviews for own sessions"
  ON public.reviews FOR INSERT
  WITH CHECK (
    parent_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE id = session_id AND parent_id = auth.uid()
    )
  );

-- Athlete Availability: Athletes can manage their own availability
CREATE POLICY "Anyone can read athlete availability"
  ON public.athlete_availability FOR SELECT
  USING (true);

CREATE POLICY "Athletes can manage own availability"
  ON public.athlete_availability FOR ALL
  USING (athlete_id = auth.uid());

-- Blocked Times: Admins can manage, anyone can read
CREATE POLICY "Anyone can read blocked times"
  ON public.blocked_times FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage blocked times"
  ON public.blocked_times FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

