-- Soft archive for users (admin can hide without deleting).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_archived_at ON public.users(archived_at);
COMMENT ON COLUMN public.users.archived_at IS 'When set, user is archived (hidden from active lists; admin can unarchive).';
