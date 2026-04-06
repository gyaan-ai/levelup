-- Run in Supabase SQL Editor (staging or production) before relying on coach application.
-- Expects each listed column to exist on public.users / public.athletes.
-- If a query returns 0 rows, add the missing column via migration before deploy.

-- === public.users columns required by /api/auth/coach-application (users insert) ===
SELECT 'users.' || column_name AS required_column
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('id', 'email', 'role', 'first_name', 'last_name', 'phone')
ORDER BY column_name;
-- Expect 6 rows. Missing first_name/last_name => run migration 20260405120000_users_first_last_name.sql

-- === public.athletes columns required by coach application (athletes insert) ===
-- Names match lib/coach-application-signup.ts (Postgres: zelle_email, safesport_expiration, background_check_expiration).
SELECT 'athletes.' || column_name AS required_column
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'athletes'
  AND column_name IN (
    'id', 'first_name', 'last_name', 'school', 'coach_type', 'weight_class', 'bio',
    'active', 'status', 'date_of_birth', 'payout_method', 'venmo_handle', 'zelle_email',
    'safesport_certified', 'safesport_expiration', 'background_check', 'background_check_expiration',
    'tshirt_size', 'agreement_signed_at'
  )
ORDER BY column_name;
-- Expect 19 rows. Missing payout_method / safesport_certified / background_check =>
--   run 20260405121000_coach_application_athletes_columns.sql
