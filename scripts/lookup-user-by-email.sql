-- =============================================================================
-- Lookup user by email — AUTH ONLY (works on any Supabase project with Auth)
-- =============================================================================
-- Replace the email once, run this entire file. You get auth_user_id + email.
--
-- If you need app role + kids, that lives in public.users / youth_wrestlers.
-- Those tables only exist after LevelUp migrations on THIS project. If they
-- don't exist, you're in the wrong Supabase project or migrations weren't run.
-- Then use: lookup-user-by-email-levelup.sql (same email).
-- =============================================================================

SELECT id AS auth_user_id,
       email,
       created_at,
       last_sign_in_at,
       email_confirmed_at
FROM auth.users
WHERE lower(email) = lower('REPLACE_WITH_EMAIL');
