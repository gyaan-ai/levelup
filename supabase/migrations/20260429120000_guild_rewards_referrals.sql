-- Guild rewards: session earn (5% cash), milestones, referrals, clawback audit.
-- Enable with REWARDS_PROGRAM_ENABLED=true in the app.

-- ---------------------------------------------------------------------------
-- credit_reversals: audit when session_earned (or similar) is clawed back
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_reversals_parent ON public.credit_reversals(parent_id);
CREATE INDEX IF NOT EXISTS idx_credit_reversals_credit ON public.credit_reversals(credit_id);

ALTER TABLE public.credit_reversals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access credit_reversals" ON public.credit_reversals;
CREATE POLICY "Service role full access credit_reversals"
  ON public.credit_reversals FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Admins can view credit_reversals" ON public.credit_reversals;
CREATE POLICY "Admins can view credit_reversals"
  ON public.credit_reversals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- credits: reward metadata + idempotency for session earn
-- ---------------------------------------------------------------------------
ALTER TABLE public.credits
  ADD COLUMN IF NOT EXISTS reward_type TEXT,
  ADD COLUMN IF NOT EXISTS session_participant_id UUID REFERENCES public.session_participants(id) ON DELETE SET NULL;

ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_source_check;
ALTER TABLE public.credits ADD CONSTRAINT credits_source_check CHECK (
  source IN ('cancellation', 'coach_cancellation', 'admin_grant', 'promotion', 'reward')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_session_earn_per_participant
  ON public.credits (session_participant_id)
  WHERE reward_type = 'session_earned' AND session_participant_id IS NOT NULL;

COMMENT ON COLUMN public.credits.reward_type IS 'reward subtype when source = reward: session_earned, referral_sent, milestone_5, etc.';
COMMENT ON COLUMN public.credits.session_participant_id IS 'Roster row this session_earned grant is tied to (idempotent + clawback).';

-- ---------------------------------------------------------------------------
-- Persist referral code captured at parent signup (attribution)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signup_referral_code TEXT;

-- ---------------------------------------------------------------------------
-- referral_codes: one row per referring parent (shareable code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_parent ON public.referral_codes(parent_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access referral_codes" ON public.referral_codes;
CREATE POLICY "Service role full access referral_codes"
  ON public.referral_codes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Parents can view own referral code" ON public.referral_codes;
CREATE POLICY "Parents can view own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "Admins can view referral_codes" ON public.referral_codes;
CREATE POLICY "Admins can view referral_codes"
  ON public.referral_codes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- referrals: referred parent can only appear once
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL REFERENCES public.referral_codes(code),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'awaiting_release', 'completed', 'expired', 'flagged')
  ),
  first_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  referrer_credit_id UUID REFERENCES public.credits(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT referrals_one_referred UNIQUE (referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access referrals" ON public.referrals;
CREATE POLICY "Service role full access referrals"
  ON public.referrals FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Parents can view own referrals" ON public.referrals;
CREATE POLICY "Parents can view own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Admins can view referrals" ON public.referrals;
CREATE POLICY "Admins can view referrals"
  ON public.referrals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- pending_referral_credits: 7-day hold before grantCredit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pending_referral_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL DEFAULT 25.00 CHECK (amount > 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  released BOOLEAN NOT NULL DEFAULT FALSE,
  released_at TIMESTAMPTZ,
  credit_id UUID REFERENCES public.credits(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_referral_credits_release
  ON public.pending_referral_credits(available_at)
  WHERE released = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_referral_credits_one_per_referral
  ON public.pending_referral_credits(referral_id);

ALTER TABLE public.pending_referral_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access pending_referral_credits" ON public.pending_referral_credits;
CREATE POLICY "Service role full access pending_referral_credits"
  ON public.pending_referral_credits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Admins can view pending_referral_credits" ON public.pending_referral_credits;
CREATE POLICY "Admins can view pending_referral_credits"
  ON public.pending_referral_credits FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- reward_milestones: one row per (parent, milestone key)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  credit_id UUID REFERENCES public.credits(id) ON DELETE SET NULL,
  UNIQUE (parent_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_reward_milestones_parent ON public.reward_milestones(parent_id);

ALTER TABLE public.reward_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access reward_milestones" ON public.reward_milestones;
CREATE POLICY "Service role full access reward_milestones"
  ON public.reward_milestones FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Parents can view own reward_milestones" ON public.reward_milestones;
CREATE POLICY "Parents can view own reward_milestones"
  ON public.reward_milestones FOR SELECT
  USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "Admins can view reward_milestones" ON public.reward_milestones;
CREATE POLICY "Admins can view reward_milestones"
  ON public.reward_milestones FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
