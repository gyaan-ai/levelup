-- Coach signup: NCAA Athlete vs Club/HS Coach. School column holds university name (NCAA) or club/HS name.
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS coach_type TEXT CHECK (coach_type IN ('ncaa_athlete', 'club_hs_coach'));

COMMENT ON COLUMN public.athletes.coach_type IS 'From signup: ncaa_athlete = Active NCAA Athlete (school = university), club_hs_coach = Club/HS Coach (school = club or HS name).';
