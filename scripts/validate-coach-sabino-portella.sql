-- =============================================================================
-- Validate coach profile: Sabino Portella (admin “Create session” needs athletes row)
-- =============================================================================
--
-- Run in the Guild Supabase project (SQL Editor). Edit ILIKE patterns if needed.
--
-- Healthy state for session creation:
--   • One auth user
--   • public.users.role = 'coach'
--   • public.athletes row with the SAME id as that user (athletes.id = users.id)
--
-- =============================================================================
-- 1) Find auth user(s) by email (adjust pattern)
-- =============================================================================

SELECT id,
       email,
       email_confirmed_at,
       created_at
FROM auth.users
WHERE email ILIKE '%sabino%'
   OR email ILIKE '%portella%';

-- =============================================================================
-- 2) public.users — role must be coach for coach accounts
-- =============================================================================

SELECT u.id,
       u.email,
       u.role,
       u.created_at
FROM public.users u
WHERE u.email ILIKE '%sabino%'
   OR u.email ILIKE '%portella%'
   OR u.id IN (
     SELECT id FROM auth.users WHERE email ILIKE '%sabino%' OR email ILIKE '%portella%'
   );

-- =============================================================================
-- 3) public.athletes — MUST exist with id = coach’s user id (this is what /api/admin/sessions checks)
-- =============================================================================

SELECT a.id,
       a.first_name,
       a.last_name,
       a.school,
       a.status,
       a.active,
       a.facility_id,
       a.secondary_facility_id,
       a.created_at
FROM public.athletes a
WHERE a.last_name ILIKE '%portella%'
   OR a.first_name ILIKE '%sabino%'
   OR a.id IN (
     SELECT id FROM public.users WHERE email ILIKE '%sabino%' OR email ILIKE '%portella%'
   );

-- =============================================================================
-- 4) Join check — same id across auth → users → athletes?
-- =============================================================================

SELECT au.id,
       au.email AS auth_email,
       pu.role AS public_users_role,
       a.id AS athletes_id,
       a.first_name,
       a.last_name,
       CASE
         WHEN pu.id IS NULL THEN 'MISSING public.users row'
         WHEN pu.role IS DISTINCT FROM 'coach' THEN 'WARNING: role is not coach'
         WHEN a.id IS NULL THEN 'PROBLEM: no athletes row — POST /api/admin/sessions returns Coach not found'
         ELSE 'OK: athletes row exists for this id'
       END AS session_create_status
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
LEFT JOIN public.athletes a ON a.id = au.id
WHERE au.email ILIKE '%sabino%'
   OR au.email ILIKE '%portella%';

-- If no rows above, try matching by athletes name only (paste id into next section manually):

-- =============================================================================
-- 5) Recent sessions for this coach (by name match on athletes)
-- =============================================================================

SELECT s.id,
       s.scheduled_datetime,
       s.status,
       s.athlete_id,
       s.facility_id,
       s.partner_invite_code
FROM public.sessions s
WHERE s.athlete_id IN (
  SELECT a.id
  FROM public.athletes a
  WHERE a.last_name ILIKE '%portella%'
     OR a.first_name ILIKE '%sabino%'
)
ORDER BY s.scheduled_datetime DESC
LIMIT 20;

-- =============================================================================
-- 6) Any coach in public.users without athletes row? (org-wide sanity)
-- =============================================================================

SELECT u.id,
       u.email,
       u.role
FROM public.users u
WHERE u.role = 'coach'
  AND NOT EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = u.id)
ORDER BY u.email;
