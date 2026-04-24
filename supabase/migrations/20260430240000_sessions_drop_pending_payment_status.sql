-- Book-a-coach "checkout shell" is now `scheduled` with parent_id ≠ athlete_id and no paid roster
-- (see app isBookingCheckoutShellSession). Remove legacy pending_payment enum value.

UPDATE public.sessions
SET status = 'scheduled'
WHERE status = 'pending_payment';

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no-show'));

DROP POLICY IF EXISTS "Authenticated can read sessions open for registration" ON public.sessions;

CREATE POLICY "Authenticated can read sessions open for registration"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    join_policy IN ('public', 'invite_only')
    AND status = 'scheduled'
  );

COMMENT ON POLICY "Authenticated can read sessions open for registration" ON public.sessions IS
  'Parents can load the register page for public/invite_only scheduled sessions.';
