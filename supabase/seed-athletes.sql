-- Complete seed script for test college athletes
-- Run this in Supabase SQL Editor
-- 
-- IMPORTANT: This script requires auth users to exist first!
-- Run seed-athletes-auth-users.sql FIRST, or create auth users via Dashboard
--
-- This script will:
-- 1. Create facilities (if they don't exist)
-- 2. Insert user entries (requires auth users to exist)
-- 3. Insert athlete profiles with complete data

-- Enable pgcrypto extension for password hashing (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- First, ensure we have facilities (create if they don't exist)
INSERT INTO public.facilities (id, name, school, address)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'UNC Wrestling Facility', 'UNC', 'Chapel Hill, NC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.facilities (id, name, school, address)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'NC State Wrestling Facility', 'NC State', 'Raleigh, NC')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- JAKE MILLER (UNC, 157 lbs, Junior, 5.0 rating)
-- ============================================================================
DO $$
DECLARE
  jake_user_id UUID := '11111111-1111-1111-1111-111111111111';
  jake_email TEXT := 'jake.miller@test.levelup.com';
BEGIN
  -- Insert into public.users (auth user must exist first!)
  INSERT INTO public.users (id, email, role)
  VALUES (jake_user_id, jake_email, 'athlete')
  ON CONFLICT (id) DO UPDATE SET email = jake_email, role = 'athlete';
  
  -- Insert athlete profile
  INSERT INTO public.athletes (
    id,
    first_name,
    last_name,
    school,
    facility_id,
    year,
    weight_class,
    bio,
    photo_url,
    credentials,
    average_rating,
    total_sessions,
    ytd_earnings,
    commitment_sessions,
    commitment_fulfilled,
    usa_wrestling_expiration,
    safesport_expiration,
    background_check_expiration,
    cpr_expiration,
    certifications_verified,
    active,
    created_at,
    updated_at
  )
  VALUES (
    jake_user_id,
    'Jake',
    'Miller',
    'UNC',
    '00000000-0000-0000-0000-000000000001',
    'Junior',
    '157',
    '3x state champion. Specializing in technique, scrambling, and hand fighting. Love helping younger wrestlers develop.',
    'https://i.pravatar.cc/400?img=12',
    '["2023 NC State Champion - 157 lbs", "2024 All-American", "100+ career wins"]'::jsonb,
    5.0,
    25,
    5000.00,
    10,
    false,
    '2026-12-31',
    '2026-12-31',
    '2026-12-31',
    '2026-12-31',
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    school = EXCLUDED.school,
    facility_id = EXCLUDED.facility_id,
    year = EXCLUDED.year,
    weight_class = EXCLUDED.weight_class,
    bio = EXCLUDED.bio,
    photo_url = EXCLUDED.photo_url,
    credentials = EXCLUDED.credentials,
    average_rating = EXCLUDED.average_rating,
    certifications_verified = EXCLUDED.certifications_verified,
    active = EXCLUDED.active,
    updated_at = NOW();
END $$;

-- ============================================================================
-- EMMA DAVIS (NC State, 133 lbs, Senior, 4.8 rating)
-- ============================================================================
DO $$
DECLARE
  emma_user_id UUID := '22222222-2222-2222-2222-222222222222';
  emma_email TEXT := 'emma.davis@test.levelup.com';
BEGIN
  -- Insert into public.users (auth user must exist first!)
  INSERT INTO public.users (id, email, role)
  VALUES (emma_user_id, emma_email, 'athlete')
  ON CONFLICT (id) DO UPDATE SET email = emma_email, role = 'athlete';
  
  -- Insert athlete profile
  INSERT INTO public.athletes (
    id,
    first_name,
    last_name,
    school,
    facility_id,
    year,
    weight_class,
    bio,
    photo_url,
    credentials,
    average_rating,
    total_sessions,
    ytd_earnings,
    commitment_sessions,
    commitment_fulfilled,
    usa_wrestling_expiration,
    safesport_expiration,
    background_check_expiration,
    cpr_expiration,
    certifications_verified,
    active,
    created_at,
    updated_at
  )
  VALUES (
    emma_user_id,
    'Emma',
    'Davis',
    'NC State',
    '00000000-0000-0000-0000-000000000002',
    'Senior',
    '133',
    '2x state finalist. Patient teacher focused on fundamentals, positioning, and mental game.',
    'https://i.pravatar.cc/400?img=47',
    '["2024 NC State Runner-Up", "ACC Qualifier", "High School All-American"]'::jsonb,
    4.8,
    18,
    3600.00,
    8,
    false,
    '2026-12-31',
    '2026-12-31',
    '2026-12-31',
    '2026-12-31',
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    school = EXCLUDED.school,
    facility_id = EXCLUDED.facility_id,
    year = EXCLUDED.year,
    weight_class = EXCLUDED.weight_class,
    bio = EXCLUDED.bio,
    photo_url = EXCLUDED.photo_url,
    credentials = EXCLUDED.credentials,
    average_rating = EXCLUDED.average_rating,
    certifications_verified = EXCLUDED.certifications_verified,
    active = EXCLUDED.active,
    updated_at = NOW();
END $$;

-- ============================================================================
-- MARCUS LEE (UNC, 174 lbs, Sophomore, 4.9 rating)
-- ============================================================================
DO $$
DECLARE
  marcus_user_id UUID := '33333333-3333-3333-3333-333333333333';
  marcus_email TEXT := 'marcus.lee@test.levelup.com';
BEGIN
  -- Insert into public.users (auth user must exist first!)
  INSERT INTO public.users (id, email, role)
  VALUES (marcus_user_id, marcus_email, 'athlete')
  ON CONFLICT (id) DO UPDATE SET email = marcus_email, role = 'athlete';
  
  -- Insert athlete profile
  INSERT INTO public.athletes (
    id,
    first_name,
    last_name,
    school,
    facility_id,
    year,
    weight_class,
    bio,
    photo_url,
    credentials,
    average_rating,
    total_sessions,
    ytd_earnings,
    commitment_sessions,
    commitment_fulfilled,
    usa_wrestling_expiration,
    safesport_expiration,
    background_check_expiration,
    cpr_expiration,
    certifications_verified,
    active,
    created_at,
    updated_at
  )
  VALUES (
    marcus_user_id,
    'Marcus',
    'Lee',
    'UNC',
    '00000000-0000-0000-0000-000000000001',
    'Sophomore',
    '174',
    'D1 wrestler with 3 years experience. Conditioning specialist. Great for all skill levels.',
    'https://i.pravatar.cc/400?img=33',
    '["ACC Qualifier", "100+ career wins", "State Champion"]'::jsonb,
    4.9,
    12,
    2400.00,
    5,
    false,
    '2026-12-31',
    '2026-12-31',
    '2026-12-31',
    '2026-12-31',
    true,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    school = EXCLUDED.school,
    facility_id = EXCLUDED.facility_id,
    year = EXCLUDED.year,
    weight_class = EXCLUDED.weight_class,
    bio = EXCLUDED.bio,
    photo_url = EXCLUDED.photo_url,
    credentials = EXCLUDED.credentials,
    average_rating = EXCLUDED.average_rating,
    certifications_verified = EXCLUDED.certifications_verified,
    active = EXCLUDED.active,
    updated_at = NOW();
END $$;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Verify the seed data was created successfully
SELECT 
  a.id,
  a.first_name || ' ' || a.last_name AS name,
  a.school,
  a.weight_class || ' lbs' AS weight,
  a.year,
  a.average_rating AS rating,
  a.active,
  a.certifications_verified,
  a.bio IS NOT NULL AND a.bio != '' AS has_bio,
  a.photo_url IS NOT NULL AS has_photo,
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
