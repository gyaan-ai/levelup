-- Parent home dismissible banners (PRD). Rows in parent_announcements are inserted via admin/service role.

CREATE TABLE IF NOT EXISTS public.parent_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_type text NOT NULL CHECK (announcement_type IN ('new_coach', 'new_location')),
  reference_id uuid NOT NULL,
  headline text NOT NULL,
  cta_label text NOT NULL DEFAULT 'View Profile',
  cta_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parent_announcements_expires ON public.parent_announcements (expires_at);

CREATE TABLE IF NOT EXISTS public.parent_announcement_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- auth.users exists in every Supabase project; public.users is created by earlier app migrations.
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_type text NOT NULL CHECK (announcement_type IN ('new_coach', 'new_location')),
  reference_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, announcement_type, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_announcement_dismissals_parent ON public.parent_announcement_dismissals (parent_id);

ALTER TABLE public.parent_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Idempotent: safe to re-run after a partial apply or SQL Editor retries.
DROP POLICY IF EXISTS "parent_announcements_select_authenticated" ON public.parent_announcements;
DROP POLICY IF EXISTS "parent_announcements_select_authenticated_parents" ON public.parent_announcements;
DROP POLICY IF EXISTS "parent_announcement_dismissals_select_own" ON public.parent_announcement_dismissals;
DROP POLICY IF EXISTS "parent_announcement_dismissals_insert_own" ON public.parent_announcement_dismissals;

-- Any signed-in user may read non-expired rows (UI is parent-only; avoids requiring public.users at migration time).
CREATE POLICY "parent_announcements_select_authenticated"
  ON public.parent_announcements FOR SELECT TO authenticated
  USING (expires_at > now() AND auth.uid() IS NOT NULL);

CREATE POLICY "parent_announcement_dismissals_select_own"
  ON public.parent_announcement_dismissals FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

CREATE POLICY "parent_announcement_dismissals_insert_own"
  ON public.parent_announcement_dismissals FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid());

COMMENT ON TABLE public.parent_announcements IS 'In-app parent home banners; insert via service role / admin tooling.';
COMMENT ON TABLE public.parent_announcement_dismissals IS 'Per-parent dismissals; unique on (parent_id, announcement_type, reference_id).';
