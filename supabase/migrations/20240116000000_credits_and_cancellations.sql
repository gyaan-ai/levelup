-- Credits and Cancellation System
-- 24-hour cancellation policy: credits instead of refunds

-- Credits table for parent account credits
CREATE TABLE IF NOT EXISTS public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  remaining DECIMAL(10,2) NOT NULL CHECK (remaining >= 0),
  source TEXT NOT NULL CHECK (source IN ('cancellation', 'coach_cancellation', 'admin_grant', 'promotion')),
  source_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  description TEXT,
  expires_at TIMESTAMPTZ, -- NULL = never expires
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding parent's available credits
CREATE INDEX IF NOT EXISTS idx_credits_parent_remaining ON public.credits(parent_id, remaining) WHERE remaining > 0;

-- Add cancellation fields to sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS credit_id UUID REFERENCES public.credits(id);

-- Track credit usage in bookings
CREATE TABLE IF NOT EXISTS public.credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for credits
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- Parents can view their own credits
CREATE POLICY "Parents can view own credits"
  ON public.credits FOR SELECT
  USING (auth.uid() = parent_id);

-- Service role can manage all credits
CREATE POLICY "Service role full access to credits"
  ON public.credits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Admins can view all credits
CREATE POLICY "Admins can view all credits"
  ON public.credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS for credit_usage
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own credit usage"
  ON public.credit_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.credits c
      WHERE c.id = credit_usage.credit_id AND c.parent_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to credit_usage"
  ON public.credit_usage FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to get parent's available credit balance
CREATE OR REPLACE FUNCTION public.get_parent_credit_balance(p_parent_id UUID)
RETURNS DECIMAL(10,2) AS $$
  SELECT COALESCE(SUM(remaining), 0)
  FROM public.credits
  WHERE parent_id = p_parent_id
    AND remaining > 0
    AND (expires_at IS NULL OR expires_at > NOW());
$$ LANGUAGE SQL STABLE;

-- Comments
COMMENT ON TABLE public.credits IS 'Parent account credits from cancellations or promotions';
COMMENT ON TABLE public.credit_usage IS 'Tracks which credits were used for which sessions';
COMMENT ON COLUMN public.sessions.cancelled_at IS 'When the session was cancelled';
COMMENT ON COLUMN public.sessions.cancelled_by IS 'User ID who cancelled (parent or coach)';
COMMENT ON COLUMN public.sessions.cancellation_reason IS 'Reason for cancellation';
COMMENT ON COLUMN public.sessions.credit_id IS 'Credit issued when this session was cancelled';
