-- User credits system for cancellation credits and prepaid balances
-- Credits expire after 1 year

CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  remaining_amount DECIMAL(10,2) NOT NULL CHECK (remaining_amount >= 0),
  source TEXT NOT NULL CHECK (source IN ('cancellation', 'admin_grant', 'refund', 'promotion')),
  source_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  description TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookup of user's available credits
CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_user_credits_expires_at ON user_credits(expires_at);

-- Track credit usage in transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_id UUID NOT NULL REFERENCES user_credits(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('used', 'expired', 'voided')),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_credit_id ON credit_transactions(credit_id);

-- RLS policies
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own credits
CREATE POLICY "Users can view own credits" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Users can view their own credit transactions  
CREATE POLICY "Users can view own credit transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can manage all credits
CREATE POLICY "Admins can manage credits" ON user_credits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admins can manage credit transactions" ON credit_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Allow inserts for credit granting (system operations via service key bypass RLS)
CREATE POLICY "Allow credit inserts" ON user_credits
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow credit transaction inserts" ON credit_transactions
  FOR INSERT WITH CHECK (true);

-- Function to get user's available credit balance
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id UUID)
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(remaining_amount), 0)
  FROM user_credits
  WHERE user_id = p_user_id
    AND remaining_amount > 0
    AND expires_at > now();
$$ LANGUAGE sql STABLE;

-- Function to apply credits to a purchase
-- Returns the amount of credits used
CREATE OR REPLACE FUNCTION apply_credits_to_purchase(
  p_user_id UUID,
  p_amount DECIMAL,
  p_session_id UUID DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
  v_remaining DECIMAL := p_amount;
  v_credit RECORD;
  v_use_amount DECIMAL;
  v_total_used DECIMAL := 0;
BEGIN
  -- Get available credits ordered by expiration (use oldest first)
  FOR v_credit IN 
    SELECT id, remaining_amount
    FROM user_credits
    WHERE user_id = p_user_id
      AND remaining_amount > 0
      AND expires_at > now()
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    
    v_use_amount := LEAST(v_credit.remaining_amount, v_remaining);
    
    -- Deduct from credit
    UPDATE user_credits
    SET remaining_amount = remaining_amount - v_use_amount,
        updated_at = now()
    WHERE id = v_credit.id;
    
    -- Record transaction
    INSERT INTO credit_transactions (user_id, credit_id, amount, transaction_type, session_id, stripe_payment_intent_id)
    VALUES (p_user_id, v_credit.id, v_use_amount, 'used', p_session_id, p_stripe_payment_intent_id);
    
    v_remaining := v_remaining - v_use_amount;
    v_total_used := v_total_used + v_use_amount;
  END LOOP;
  
  RETURN v_total_used;
END;
$$ LANGUAGE plpgsql;

-- Function to grant credits (for cancellations, admin grants, etc.)
CREATE OR REPLACE FUNCTION grant_credits(
  p_user_id UUID,
  p_amount DECIMAL,
  p_source TEXT,
  p_source_session_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_credit_id UUID;
BEGIN
  INSERT INTO user_credits (user_id, amount, remaining_amount, source, source_session_id, description, expires_at)
  VALUES (p_user_id, p_amount, p_amount, p_source, p_source_session_id, p_description, now() + INTERVAL '1 year')
  RETURNING id INTO v_credit_id;
  
  RETURN v_credit_id;
END;
$$ LANGUAGE plpgsql;
