-- Rename coach role: 'athlete' -> 'coach' for users who teach (session providers).
-- Athlete now means the youth being instructed; coach means the person teaching.

-- 1. Drop constraint so we can change role values (existing rows have 'athlete')
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Backfill: set coach accounts to 'coach'
UPDATE public.users
SET role = 'coach'
WHERE role = 'athlete';

-- 3. Re-add constraint (no longer allow 'athlete')
ALTER TABLE public.users
ADD CONSTRAINT users_role_check
CHECK (role IN ('parent', 'coach', 'admin', 'youth_wrestler'));

-- 3. RLS: coach_follows — coaches can read own followers
DROP POLICY IF EXISTS "Coaches can read own followers" ON public.coach_follows;
CREATE POLICY "Coaches can read own followers"
  ON public.coach_follows FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'coach')
  );

-- 4. RLS: facility_requests — coaches can insert own request
DROP POLICY IF EXISTS "Athletes can insert own facility request" ON public.facility_requests;
CREATE POLICY "Coaches can insert own facility request"
  ON public.facility_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by_athlete_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'coach')
  );

-- 5. RLS: youth_wrestlers — coaches and admins can view (for booking)
DROP POLICY IF EXISTS "Athletes can view youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Coaches can view youth wrestlers"
  ON public.youth_wrestlers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('coach', 'admin')
    )
  );
