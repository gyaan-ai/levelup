CREATE TABLE IF NOT EXISTS user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  remaining numeric(10,2) NOT NULL,
  reason text NOT NULL,
  source_type text NOT NULL,
  source_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
