-- =============================================================================
-- Revoke parent_percentage_discounts for one parent (by login email)
-- =============================================================================
--
-- PART 1 — Run this to list matching users. Copy the exact `email` you want.
--
SELECT id, email, created_at
FROM auth.users
WHERE email ILIKE '%jgt%'
   OR email ILIKE '%415%'
   OR email ILIKE '%taylor%';

SELECT yw.parent_id, au.email, yw.first_name, yw.last_name
FROM public.youth_wrestlers yw
LEFT JOIN auth.users au ON au.id = yw.parent_id
WHERE yw.first_name ILIKE '%joe%'
  AND yw.last_name ILIKE '%taylor%';

SELECT ppd.parent_id, au.email, ppd.percent_off
FROM public.parent_percentage_discounts ppd
LEFT JOIN auth.users au ON au.id = ppd.parent_id;

-- =============================================================================
-- PART 2 — Revoke discount (run this AFTER you edit the email on the next line)
--
-- 1. Find the line that says:    'PASTE_PARENT_EMAIL_FROM_PART_1_HERE'
-- 2. Delete that text and type the real email (keep the single quotes).
--    Example:  'mom@gmail.com'
-- 3. Run ONLY PART 2 (select from DELETE through the semicolon), or clear the
--    editor and paste only PART 2 so you do not re-run PART 1 by mistake.
--
-- If Supabase says "0 rows deleted", either the email does not match auth.users,
-- that parent has no row in parent_percentage_discounts, or wrong project.
-- =============================================================================

DELETE FROM public.parent_percentage_discounts
WHERE parent_id = (
  SELECT id
  FROM auth.users
  WHERE lower(trim(email::text)) = lower(trim('PASTE_PARENT_EMAIL_FROM_PART_1_HERE'))
);
