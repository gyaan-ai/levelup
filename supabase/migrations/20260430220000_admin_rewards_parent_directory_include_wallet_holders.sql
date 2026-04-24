-- Parent credits directory excluded admin/coach accounts that still have a Guild wallet
-- (credits.parent_id) and book sessions. Include anyone with credit rows who can hold a wallet.

CREATE OR REPLACE FUNCTION public.admin_rewards_parent_directory()
RETURNS TABLE (
  id UUID,
  parent_name TEXT,
  session_count BIGINT,
  total_earned NUMERIC,
  total_redeemed NUMERIC,
  current_balance NUMERIC,
  last_activity TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH credit_parents AS (
    SELECT DISTINCT c.parent_id FROM public.credits c
  ),
  usage_totals AS (
    SELECT
      c.parent_id,
      SUM(cu.amount)::numeric AS redeemed,
      MAX(cu.created_at) AS last_u
    FROM public.credit_usage cu
    INNER JOIN public.credits c ON c.id = cu.credit_id
    GROUP BY c.parent_id
  ),
  credit_totals AS (
    SELECT
      c.parent_id,
      SUM(c.amount)::numeric AS earned,
      SUM(c.remaining)::numeric AS balance,
      MAX(c.created_at) AS last_c
    FROM public.credits c
    GROUP BY c.parent_id
  ),
  rev_last AS (
    SELECT
      cr.parent_id,
      MAX(cr.created_at) AS last_r
    FROM public.credit_reversals cr
    GROUP BY cr.parent_id
  ),
  sessions_per AS (
    SELECT sp.parent_id, COUNT(*)::bigint AS n
    FROM public.session_participants sp
    WHERE sp.paid = true
    GROUP BY sp.parent_id
  )
  SELECT
    u.id,
    TRIM(
      COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')
    ) AS parent_name,
    COALESCE(sp.n, 0::bigint) AS session_count,
    COALESCE(ct.earned, 0::numeric) AS total_earned,
    COALESCE(ut.redeemed, 0::numeric) AS total_redeemed,
    COALESCE(ct.balance, 0::numeric) AS current_balance,
    GREATEST(
      COALESCE(ct.last_c, '-infinity'::timestamptz),
      COALESCE(ut.last_u, '-infinity'::timestamptz),
      COALESCE(rl.last_r, '-infinity'::timestamptz)
    ) AS last_activity
  FROM public.users u
  INNER JOIN credit_parents cp ON cp.parent_id = u.id
  LEFT JOIN credit_totals ct ON ct.parent_id = u.id
  LEFT JOIN usage_totals ut ON ut.parent_id = u.id
  LEFT JOIN rev_last rl ON rl.parent_id = u.id
  LEFT JOIN sessions_per sp ON sp.parent_id = u.id
  WHERE u.role = ANY (ARRAY['parent', 'admin', 'coach']::text[]);
$$;
