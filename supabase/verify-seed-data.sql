-- Verification script to check if seed data was created successfully
-- Run this after seed-athletes.sql to verify everything worked

-- Check auth users
SELECT 
  'Auth Users' AS check_type,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) = 3 THEN '✓ All 3 auth users created'
    ELSE '✗ Missing auth users - expected 3, found ' || COUNT(*)::text
  END AS status
FROM auth.users
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Check public.users
SELECT 
  'Public Users' AS check_type,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) = 3 THEN '✓ All 3 users created'
    ELSE '✗ Missing users - expected 3, found ' || COUNT(*)::text
  END AS status
FROM public.users
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Check athletes
SELECT 
  'Athletes' AS check_type,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) = 3 THEN '✓ All 3 athletes created'
    ELSE '✗ Missing athletes - expected 3, found ' || COUNT(*)::text
  END AS status
FROM public.athletes
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Detailed athlete information
SELECT 
  a.first_name || ' ' || a.last_name AS name,
  a.school,
  a.weight_class || ' lbs' AS weight,
  a.year,
  a.average_rating AS rating,
  a.active,
  a.certifications_verified,
  CASE WHEN a.bio IS NOT NULL AND a.bio != '' THEN '✓' ELSE '✗' END AS has_bio,
  CASE WHEN a.photo_url IS NOT NULL THEN '✓' ELSE '✗' END AS has_photo,
  CASE WHEN a.credentials IS NOT NULL AND jsonb_array_length(a.credentials::jsonb) > 0 THEN '✓' ELSE '✗' END AS has_credentials,
  u.email,
  f.name AS facility_name
FROM public.athletes a
JOIN public.users u ON a.id = u.id
LEFT JOIN public.facilities f ON a.facility_id = f.id
WHERE a.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY a.average_rating DESC;

-- Check facilities
SELECT 
  'Facilities' AS check_type,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) >= 2 THEN '✓ Facilities exist'
    ELSE '✗ Missing facilities'
  END AS status
FROM public.facilities
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);

