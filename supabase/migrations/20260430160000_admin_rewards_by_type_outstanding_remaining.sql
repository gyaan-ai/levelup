-- Credits-by-type "Outstanding" must reflect unspent balance (SUM(remaining)) for grants
-- issued in the month, not (issued - redeemed). Admin voids (remaining=0) without credit_usage
-- rows were still showing phantom outstanding.

DROP FUNCTION IF EXISTS public.admin_rewards_by_type_month(timestamp with time zone, timestamp with time zone);

CREATE FUNCTION public.admin_rewards_by_type_month(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE (
  bucket TEXT,
  issued NUMERIC,
  redeemed NUMERIC,
  outstanding NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH credit_bucket AS (
    SELECT
      c.id,
      CASE
        WHEN c.reward_type = 'session_earned' THEN 'session'
        WHEN c.reward_type = 'referral_sent' THEN 'referral'
        WHEN c.reward_type LIKE 'milestone%' THEN 'milestone'
        WHEN c.reward_type = 'review' THEN 'review'
        WHEN c.reward_type = 'manual' OR c.source = 'admin_grant' THEN 'manual'
        WHEN c.source IN ('cancellation', 'coach_cancellation') THEN 'cancellation'
        WHEN c.source = 'promotion' THEN 'promotion'
        ELSE 'other'
      END AS bucket
    FROM public.credits c
  ),
  issued AS (
    SELECT
      cb.bucket,
      SUM(c.amount)::numeric AS issued
    FROM public.credits c
    INNER JOIN credit_bucket cb ON cb.id = c.id
    WHERE c.created_at >= p_start AND c.created_at < p_end
    GROUP BY cb.bucket
  ),
  redeemed AS (
    SELECT
      cb.bucket,
      SUM(cu.amount)::numeric AS redeemed
    FROM public.credit_usage cu
    INNER JOIN credit_bucket cb ON cb.id = cu.credit_id
    WHERE cu.created_at >= p_start AND cu.created_at < p_end
    GROUP BY cb.bucket
  ),
  still_open AS (
    SELECT
      cb.bucket,
      SUM(c.remaining)::numeric AS outstanding
    FROM public.credits c
    INNER JOIN credit_bucket cb ON cb.id = c.id
    WHERE c.created_at >= p_start AND c.created_at < p_end
      AND c.remaining > 0
      AND (c.expires_at IS NULL OR c.expires_at > NOW())
    GROUP BY cb.bucket
  ),
  keys AS (
    SELECT unnest(ARRAY[
      'session','referral','milestone','review','cancellation','manual','promotion','other'
    ]) AS bucket
  )
  SELECT
    k.bucket,
    COALESCE(i.issued, 0::numeric) AS issued,
    COALESCE(r.redeemed, 0::numeric) AS redeemed,
    COALESCE(o.outstanding, 0::numeric) AS outstanding
  FROM keys k
  LEFT JOIN issued i ON i.bucket = k.bucket
  LEFT JOIN redeemed r ON r.bucket = k.bucket
  LEFT JOIN still_open o ON o.bucket = k.bucket;
$$;

REVOKE ALL ON FUNCTION public.admin_rewards_by_type_month(timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rewards_by_type_month(timestamp with time zone, timestamp with time zone) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_rewards_by_type_month(timestamp with time zone, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rewards_by_type_month(timestamp with time zone, timestamp with time zone) TO service_role;
