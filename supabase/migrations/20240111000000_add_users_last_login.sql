-- Add last_login_at to users for admin dashboard reporting
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_last_login ON public.users(last_login_at);
