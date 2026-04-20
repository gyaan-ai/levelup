-- Admin coach-help engagement: include featured + every coach_help_resources row (zeros when no activity).

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
  WITH all_keys AS (
    SELECT 'featured:home_screen'::text AS vk
    UNION
    SELECT ('resource:' || r.id::text) FROM public.coach_help_resources r
  ),
  v AS (
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
    k.vk::text,
    coalesce(v.vc, 0)::bigint,
    coalesce(v.uv, 0)::bigint,
    coalesce(vt.uc, 0)::bigint,
    coalesce(vt.dc, 0)::bigint
  FROM all_keys k
  LEFT JOIN v ON v.vk = k.vk
  LEFT JOIN vt ON vt.vk = k.vk
  ORDER BY
    CASE WHEN k.vk = 'featured:home_screen' THEN 0 ELSE 1 END,
    k.vk;
END;
$$;
