-- Admin rewards dashboard: launch bonus audit, referral flag metadata, ledger RPC.

-- ---------------------------------------------------------------------------
-- One-off retro launch bonus (prevent duplicate full runs per tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rewards_launch_bonus_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  parents_affected INT NOT NULL DEFAULT 0,
  sessions_credited INT NOT NULL DEFAULT 0,
  total_amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rewards_launch_bonus_one_per_tenant
  ON public.rewards_launch_bonus_runs (tenant_slug);

ALTER TABLE public.rewards_launch_bonus_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access rewards_launch_bonus_runs" ON public.rewards_launch_bonus_runs;
CREATE POLICY "Service role full access rewards_launch_bonus_runs"
  ON public.rewards_launch_bonus_runs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Admins can view rewards_launch_bonus_runs" ON public.rewards_launch_bonus_runs;
CREATE POLICY "Admins can view rewards_launch_bonus_runs"
  ON public.rewards_launch_bonus_runs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Referral flag: preserve prior status for unflag; optional admin note
-- ---------------------------------------------------------------------------
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_before_flag TEXT;

ALTER TABLE public.pending_referral_credits
  ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.pending_referral_credits SET frozen = FALSE WHERE frozen IS NULL;

-- ---------------------------------------------------------------------------
-- Ledger with running balance (newest-first page; balance_after is post-entry)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_rewards_parent_ledger(
  p_parent_id UUID,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  entry_ts TIMESTAMPTZ,
  entry_kind TEXT,
  entry_id TEXT,
  description TEXT,
  reward_type TEXT,
  amount NUMERIC,
  balance_after NUMERIC,
  credit_row_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH events AS (
    SELECT
      c.created_at AS ts,
      1 AS ord,
      'g:' || c.id::text AS sk,
      'grant'::text AS entry_kind,
      c.id::text AS entry_id,
      COALESCE(c.description, '') AS description,
      c.reward_type,
      c.amount::numeric AS delta,
      c.id AS credit_row_id
    FROM public.credits c
    WHERE c.parent_id = p_parent_id
    UNION ALL
    SELECT
      cu.created_at,
      2,
      'u:' || cu.id::text,
      'applied',
      cu.id::text,
      'Applied at checkout',
      NULL::text,
      -(cu.amount::numeric),
      cu.credit_id
    FROM public.credit_usage cu
    INNER JOIN public.credits c ON c.id = cu.credit_id
    WHERE c.parent_id = p_parent_id
    UNION ALL
    SELECT
      cr.created_at,
      3,
      'r:' || cr.id::text,
      'reversal',
      cr.id::text,
      COALESCE(cr.reason, 'Credit adjustment'),
      NULL::text,
      -(cr.amount::numeric),
      cr.credit_id
    FROM public.credit_reversals cr
    WHERE cr.parent_id = p_parent_id
  ),
  ordered AS (
    SELECT
      e.ts AS entry_ts,
      e.sk AS sort_key,
      e.entry_kind,
      e.entry_id,
      e.description,
      e.reward_type,
      e.delta AS amount,
      e.credit_row_id,
      SUM(e.delta) OVER (ORDER BY e.ts ASC, e.ord ASC, e.sk ASC) AS balance_after
    FROM events e
  )
  SELECT
    o.entry_ts,
    o.entry_kind,
    o.entry_id,
    o.description,
    o.reward_type,
    o.amount,
    o.balance_after,
    o.credit_row_id
  FROM ordered o
  ORDER BY o.entry_ts DESC, o.sort_key DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.admin_rewards_parent_ledger IS 'Admin rewards: parent wallet ledger rows newest-first with running balance_after (chronological).';

-- ---------------------------------------------------------------------------
-- Parent directory (credit activity): aggregates for admin table
-- ---------------------------------------------------------------------------
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
  WHERE u.role = 'parent';
$$;

-- ---------------------------------------------------------------------------
-- Summary aggregates for dashboard cards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_rewards_outstanding_liability()
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(c.remaining), 0)::numeric
  FROM public.credits c
  WHERE c.remaining > 0
    AND (c.expires_at IS NULL OR c.expires_at > NOW());
$$;

CREATE OR REPLACE FUNCTION public.admin_rewards_issued_in_range(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      COALESCE(SUM(c.amount), 0)::numeric AS total,
      COALESCE(SUM(c.amount) FILTER (WHERE c.reward_type = 'session_earned'), 0)::numeric AS session,
      COALESCE(SUM(c.amount) FILTER (WHERE c.reward_type = 'referral_sent'), 0)::numeric AS referral,
      COALESCE(SUM(c.amount) FILTER (WHERE c.reward_type LIKE 'milestone%'), 0)::numeric AS milestone,
      COALESCE(SUM(c.amount) FILTER (WHERE c.reward_type = 'review'), 0)::numeric AS review,
      COALESCE(
        SUM(c.amount) FILTER (WHERE c.reward_type = 'manual' OR c.source = 'admin_grant'),
        0
      )::numeric AS manual,
      COALESCE(
        SUM(c.amount) FILTER (WHERE c.source IN ('cancellation', 'coach_cancellation')),
        0
      )::numeric AS cancellation,
      COALESCE(SUM(c.amount) FILTER (WHERE c.source = 'promotion'), 0)::numeric AS promotion
    FROM public.credits c
    WHERE c.created_at >= p_start AND c.created_at < p_end
  )
  SELECT jsonb_build_object(
    'total', s.total,
    'session', s.session,
    'referral', s.referral,
    'milestone', s.milestone,
    'review', s.review,
    'manual', s.manual,
    'cancellation', s.cancellation,
    'promotion', s.promotion,
    'other', GREATEST(
      0::numeric,
      s.total - (s.session + s.referral + s.milestone + s.review + s.manual + s.cancellation + s.promotion)
    )
  )
  FROM s;
$$;

CREATE OR REPLACE FUNCTION public.admin_rewards_redeemed_in_range(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cu.amount), 0)::numeric
  FROM public.credit_usage cu
  WHERE cu.created_at >= p_start AND cu.created_at < p_end;
$$;

CREATE OR REPLACE FUNCTION public.admin_rewards_pending_referrals_hold()
RETURNS TABLE (cnt BIGINT, hold_total NUMERIC)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(p.amount), 0)::numeric
  FROM public.pending_referral_credits p
  WHERE p.released = false;
$$;

-- Monthly issuance vs redemption by display bucket (redeemed attributed to original grant bucket)
CREATE OR REPLACE FUNCTION public.admin_rewards_by_type_month(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE (
  bucket TEXT,
  issued NUMERIC,
  redeemed NUMERIC
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
  keys AS (
    SELECT unnest(ARRAY[
      'session','referral','milestone','review','cancellation','manual','promotion','other'
    ]) AS bucket
  )
  SELECT
    k.bucket,
    COALESCE(i.issued, 0::numeric) AS issued,
    COALESCE(r.redeemed, 0::numeric) AS redeemed
  FROM keys k
  LEFT JOIN issued i ON i.bucket = k.bucket
  LEFT JOIN redeemed r ON r.bucket = k.bucket;
$$;
