-- Atomically restore credits when usage was recorded but the parent never got a roster row
-- on that session (legacy applyCredits-before-insert bug).

CREATE OR REPLACE FUNCTION public.admin_reverse_orphaned_booking_credits(p_parent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agg record;
  total_restored numeric := 0;
  deleted int := 0;
BEGIN
  CREATE TEMP TABLE _orphan_cu ON COMMIT DROP AS
  SELECT cu.id, cu.credit_id, cu.amount::numeric AS amount
  FROM public.credit_usage cu
  INNER JOIN public.credits c ON c.id = cu.credit_id AND c.parent_id = p_parent_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.session_participants sp
    WHERE sp.session_id = cu.session_id
      AND sp.parent_id = p_parent_id
  );

  FOR agg IN
    SELECT credit_id, SUM(amount) AS s FROM _orphan_cu GROUP BY credit_id
  LOOP
    UPDATE public.credits
    SET remaining = remaining + agg.s,
        updated_at = now()
    WHERE id = agg.credit_id;
    total_restored := total_restored + agg.s;
  END LOOP;

  DELETE FROM public.credit_usage cu USING _orphan_cu o WHERE cu.id = o.id;
  GET DIAGNOSTICS deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'restoredUsd', total_restored,
    'reversedUsageRowCount', deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reverse_orphaned_booking_credits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reverse_orphaned_booking_credits(uuid) TO service_role;

COMMENT ON FUNCTION public.admin_reverse_orphaned_booking_credits(uuid) IS
  'Admin/service: refund credits for sessions where parent has no session_participants row.';
