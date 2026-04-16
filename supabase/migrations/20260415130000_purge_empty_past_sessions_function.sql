-- One-shot cleanup for scale: delete past sessions with no roster rows (session_participants).
-- Does not rely on sessions.current_participants (can drift). Any status is eligible if empty + past.

CREATE OR REPLACE FUNCTION public.purge_empty_past_sessions()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.sessions s
  WHERE s.scheduled_datetime IS NOT NULL
    AND s.scheduled_datetime < now()
    AND NOT EXISTS (
      SELECT 1 FROM public.session_participants sp WHERE sp.session_id = s.id
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN COALESCE(deleted_count, 0);
END;
$$;

COMMENT ON FUNCTION public.purge_empty_past_sessions() IS
  'Server/cron only: permanently removes past sessions with zero session_participants rows.';

REVOKE ALL ON FUNCTION public.purge_empty_past_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_empty_past_sessions() TO service_role;
