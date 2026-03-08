-- Enforce one user per email address: same email (case-insensitive, trimmed) cannot appear on multiple accounts.
-- Existing UNIQUE on (email) only prevents exact string duplicates; this prevents "User@Mail.com" and "user@mail.com" both existing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique
  ON public.users (LOWER(TRIM(email)));

COMMENT ON INDEX public.idx_users_email_lower_unique IS 'One normalized email per user; prevents duplicate accounts for same address.';
