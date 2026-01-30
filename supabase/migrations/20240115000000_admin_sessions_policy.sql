-- Allow admins to create sessions (for testing booking flow)
CREATE POLICY "Admins can create sessions"
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to read all sessions (for admin dashboard + testing)
CREATE POLICY "Admins can read all sessions"
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to update any session (for admin operations)
CREATE POLICY "Admins can update any session"
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
