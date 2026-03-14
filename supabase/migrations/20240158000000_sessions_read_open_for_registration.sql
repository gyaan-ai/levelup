-- Allow authenticated users to read sessions that are open for registration
-- (public or invite_only, scheduled/pending_payment). Fixes "Session not found"
-- when a parent tries to join a small group via the register page or API.
CREATE POLICY "Authenticated can read sessions open for registration"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    join_policy IN ('public', 'invite_only')
    AND status IN ('scheduled', 'pending_payment')
  );

COMMENT ON POLICY "Authenticated can read sessions open for registration" ON public.sessions IS
  'Parents can load the register page and complete registration for public/invite_only sessions.';
