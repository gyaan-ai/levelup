-- Allow admins to manage their own coach follows (same as parents)
CREATE POLICY "Admins can manage own follows"
  ON public.coach_follows
  FOR ALL
  TO authenticated
  USING (
    parent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    parent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
