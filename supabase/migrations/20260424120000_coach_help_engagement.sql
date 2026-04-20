-- Coach help: view events, per-user votes, questions (featured + per-resource keys).

CREATE TABLE IF NOT EXISTS public.coach_help_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  video_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_help_views_user_video_idx
  ON public.coach_help_views (user_id, video_key);

CREATE INDEX IF NOT EXISTS coach_help_views_video_created_idx
  ON public.coach_help_views (video_key, created_at DESC);

COMMENT ON TABLE public.coach_help_views IS 'Append-only coach help video “view” events (e.g. embed loaded or explicit open).';

CREATE TABLE IF NOT EXISTS public.coach_help_votes (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  video_key text NOT NULL,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_key)
);

CREATE INDEX IF NOT EXISTS coach_help_votes_video_idx ON public.coach_help_votes (video_key);

COMMENT ON TABLE public.coach_help_votes IS 'One vote per user per coach-help video_key (-1 down, 1 up).';

CREATE TABLE IF NOT EXISTS public.coach_help_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  video_key text NOT NULL,
  body text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  answer_text text,
  answered_at timestamptz,
  answered_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  CHECK (answer_text IS NULL OR char_length(trim(answer_text)) > 0)
);

CREATE INDEX IF NOT EXISTS coach_help_questions_video_idx
  ON public.coach_help_questions (video_key, created_at DESC);

COMMENT ON TABLE public.coach_help_questions IS 'Coach questions on a specific coach-help video; admins can answer.';

-- Vote totals for dashboards (bypasses row-level vote privacy).
CREATE OR REPLACE FUNCTION public.coach_help_vote_summary(p_video_key text)
RETURNS TABLE(up_count bigint, down_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    count(*) FILTER (WHERE v.vote = 1)::bigint,
    count(*) FILTER (WHERE v.vote = -1)::bigint
  FROM public.coach_help_votes v
  WHERE v.video_key = p_video_key;
$$;

REVOKE ALL ON FUNCTION public.coach_help_vote_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_help_vote_summary(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_help_admin_engagement_stats()
RETURNS TABLE(
  video_key text,
  view_count bigint,
  unique_viewers bigint,
  up_count bigint,
  down_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH v AS (
    SELECT vs.video_key AS vk, count(*)::bigint AS vc, count(DISTINCT vs.user_id)::bigint AS uv
    FROM public.coach_help_views vs
    GROUP BY vs.video_key
  ),
  vt AS (
    SELECT vv.video_key AS vk,
      count(*) FILTER (WHERE vv.vote = 1)::bigint AS uc,
      count(*) FILTER (WHERE vv.vote = -1)::bigint AS dc
    FROM public.coach_help_votes vv
    GROUP BY vv.video_key
  )
  SELECT
    coalesce(v.vk, vt.vk)::text,
    coalesce(v.vc, 0)::bigint,
    coalesce(v.uv, 0)::bigint,
    coalesce(vt.uc, 0)::bigint,
    coalesce(vt.dc, 0)::bigint
  FROM v
  FULL OUTER JOIN vt ON v.vk = vt.vk;
END;
$$;

REVOKE ALL ON FUNCTION public.coach_help_admin_engagement_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_help_admin_engagement_stats() TO authenticated;

ALTER TABLE public.coach_help_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_help_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_help_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_help_views_insert_self
  ON public.coach_help_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY coach_help_views_select_self
  ON public.coach_help_views
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY coach_help_votes_select_self
  ON public.coach_help_votes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY coach_help_votes_insert_self
  ON public.coach_help_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY coach_help_votes_update_self
  ON public.coach_help_votes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY coach_help_votes_delete_self
  ON public.coach_help_votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY coach_help_questions_select_coach_admin
  ON public.coach_help_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY coach_help_questions_insert_coach_admin
  ON public.coach_help_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('coach', 'admin')
    )
  );

CREATE POLICY coach_help_questions_update_admin_answer
  ON public.coach_help_questions
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
