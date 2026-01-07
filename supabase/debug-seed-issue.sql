-- Debug script to check what's missing
-- Run this to see what went wrong with the seed

-- Check if auth users exist
SELECT 'Auth Users Check' AS check_type, id, email, created_at
FROM auth.users
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY email;

-- Check if public.users exist
SELECT 'Public Users Check' AS check_type, id, email, role, created_at
FROM public.users
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY email;

-- Check if athletes exist
SELECT 'Athletes Check' AS check_type, id, first_name, last_name, school, active, certifications_verified
FROM public.athletes
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY first_name;

-- Check foreign key constraint
SELECT 
  'Foreign Key Check' AS check_type,
  u.id AS user_id,
  u.email,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id) THEN '✓ Auth user exists'
    ELSE '✗ Auth user MISSING - this is the problem!'
  END AS auth_status
FROM public.users u
WHERE u.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

