-- Athletes can SELECT their own profile (active or not).
-- This allows onboarding GET/verify and profile edits to work before athlete is active.
-- "Anyone can view active athletes" still controls public browse.
CREATE POLICY "Athletes can read own profile"
  ON public.athletes FOR SELECT
  USING (auth.uid() = id);
