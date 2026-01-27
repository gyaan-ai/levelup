-- ============================================================================
-- COMPREHENSIVE DATABASE CHECK SCRIPT
-- ============================================================================
-- Run this in Supabase SQL Editor to check your database state
-- This will show you what exists and what's missing

-- ============================================================================
-- 1. OVERVIEW - Total counts
-- ============================================================================
SELECT 
  '📊 OVERVIEW' AS section,
  (SELECT COUNT(*) FROM auth.users) AS total_auth_users,
  (SELECT COUNT(*) FROM public.users) AS total_public_users,
  (SELECT COUNT(*) FROM public.athletes) AS total_athletes,
  (SELECT COUNT(*) FROM public.facilities) AS total_facilities;

-- ============================================================================
-- 2. AUTH USERS CHECK - Check if seed auth users exist
-- ============================================================================
SELECT 
  '🔐 AUTH USERS' AS section,
  COUNT(*) AS found_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ No auth users found - CREATE THESE FIRST via Dashboard'
    WHEN COUNT(*) < 3 THEN '⚠️  Partial: ' || COUNT(*)::text || ' of 3 users exist'
    ELSE '✅ All 3 auth users exist'
  END AS status
FROM auth.users
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Detailed auth users check
SELECT 
  '🔐 Auth User Details' AS check_type,
  id,
  email,
  email_confirmed_at IS NOT NULL AS email_confirmed,
  created_at
FROM auth.users
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY email;

-- ============================================================================
-- 3. PUBLIC USERS CHECK - Check if seed public.users exist
-- ============================================================================
SELECT 
  '👥 PUBLIC USERS' AS section,
  COUNT(*) AS found_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ No public users found'
    WHEN COUNT(*) < 3 THEN '⚠️  Partial: ' || COUNT(*)::text || ' of 3 users exist'
    ELSE '✅ All 3 public users exist'
  END AS status
FROM public.users
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Detailed public users check
SELECT 
  '👥 Public User Details' AS check_type,
  u.id,
  u.email,
  u.role,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id) THEN '✅ Auth user exists'
    ELSE '❌ Auth user MISSING - FK constraint will fail!'
  END AS auth_status,
  u.created_at
FROM public.users u
WHERE u.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY u.email;

-- ============================================================================
-- 4. ATHLETES CHECK - Check if seed athletes exist
-- ============================================================================
SELECT 
  '🏃 ATHLETES' AS section,
  COUNT(*) AS found_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ No athletes found'
    WHEN COUNT(*) < 3 THEN '⚠️  Partial: ' || COUNT(*)::text || ' of 3 athletes exist'
    ELSE '✅ All 3 athletes exist'
  END AS status
FROM public.athletes
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Detailed athletes check
SELECT 
  '🏃 Athlete Details' AS check_type,
  a.id,
  a.first_name || ' ' || a.last_name AS name,
  a.school,
  a.weight_class || ' lbs' AS weight,
  a.year,
  a.active,
  a.certifications_verified,
  a.average_rating AS rating,
  CASE WHEN u.id IS NOT NULL THEN '✅ User exists' ELSE '❌ User missing' END AS user_status,
  CASE WHEN f.id IS NOT NULL THEN '✅ Facility: ' || f.name ELSE '⚠️  No facility' END AS facility_status
FROM public.athletes a
LEFT JOIN public.users u ON a.id = u.id
LEFT JOIN public.facilities f ON a.facility_id = f.id
WHERE a.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY a.first_name;

-- ============================================================================
-- 5. FACILITIES CHECK
-- ============================================================================
SELECT 
  '🏟️  FACILITIES' AS section,
  COUNT(*) AS found_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ No facilities found'
    WHEN COUNT(*) < 2 THEN '⚠️  Partial: ' || COUNT(*)::text || ' of 2 facilities exist'
    ELSE '✅ All facilities exist'
  END AS status
FROM public.facilities
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

SELECT 
  '🏟️  Facility Details' AS check_type,
  id,
  name,
  school,
  address
FROM public.facilities
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
)
ORDER BY school;

-- ============================================================================
-- 6. FOREIGN KEY INTEGRITY CHECK
-- ============================================================================
SELECT 
  '🔗 INTEGRITY CHECK' AS section,
  COUNT(*) AS issues_found,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ No foreign key issues found'
    ELSE '❌ Found ' || COUNT(*)::text || ' foreign key issues'
  END AS status
FROM public.users u
WHERE u.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);

-- List all integrity issues
SELECT 
  '🔗 Integrity Issue' AS check_type,
  u.id AS user_id,
  u.email,
  '❌ Public user exists but auth user is missing' AS issue
FROM public.users u
WHERE u.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);

-- ============================================================================
-- 7. NEXT STEPS RECOMMENDATION
-- ============================================================================
SELECT 
  '📋 NEXT STEPS' AS section,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')) = 0
      THEN '1️⃣  CREATE AUTH USERS via Dashboard: Authentication > Users > Add User'
    WHEN (SELECT COUNT(*) FROM public.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')) < 3
      THEN '2️⃣  RUN seed-athletes.sql to create public users and athletes'
    WHEN (SELECT COUNT(*) FROM public.athletes WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')) < 3
      THEN '3️⃣  RUN seed-athletes.sql to create athlete profiles'
    ELSE '✅ Database looks good! All seed data is present.'
  END AS recommendation;

