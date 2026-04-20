-- Curated how-to links (Loom/YouTube) shown on /coach-help. Coaches read; admins manage.

CREATE TABLE IF NOT EXISTS public.coach_help_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coach_help_resources IS 'Extra coach-facing tutorial links for The Guild /coach-help page.';

ALTER TABLE public.coach_help_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_help_resources_select_coach_admin
  ON public.coach_help_resources
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY coach_help_resources_insert_admin
  ON public.coach_help_resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY coach_help_resources_update_admin
  ON public.coach_help_resources
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY coach_help_resources_delete_admin
  ON public.coach_help_resources
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS coach_help_resources_created_at_idx
  ON public.coach_help_resources (created_at DESC);
