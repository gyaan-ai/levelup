-- Seed script for test college athletes
-- Run this in Supabase SQL Editor
-- 
-- IMPORTANT: This script ONLY inserts data - it does NOT create tables
-- Make sure you've run all migrations first before running this seed script
-- 
-- This script will:
-- 1. Create facilities (if they don't exist)
-- 2. Insert test athlete data into existing tables
-- 
-- You MUST create the auth users first via Supabase Dashboard or Admin API
-- See instructions at the bottom of this script

-- First, ensure we have facilities (create if they don't exist)
INSERT INTO public.facilities (id, name, school, address)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'UNC Wrestling Facility', 'UNC', 'Chapel Hill, NC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.facilities (id, name, school, address)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'NC State Wrestling Facility', 'NC State', 'Raleigh, NC')
ON CONFLICT (id) DO NOTHING;

-- Create auth users and athlete profiles
-- Note: We'll use Supabase's auth.users table directly
-- These UUIDs are fixed for testing purposes

-- Jake Miller (UNC, 157 lbs)
DO $$
DECLARE
  jake_user_id UUID := '11111111-1111-1111-1111-111111111111';
  jake_email TEXT := 'jake.miller@test.levelup.com';
BEGIN
  -- Create auth user (if using Supabase Admin API, create via API first)
  -- For SQL, we'll insert directly into auth.users (requires superuser)
  -- Alternatively, create these users via Supabase Dashboard or Admin API first
  
  -- Insert into public.users
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
    'Senior',
    '157',
    'Jake Miller is a senior wrestler at UNC with a proven track record of excellence. Known for his technical precision and competitive drive, Jake has competed at the highest levels of collegiate wrestling. He brings years of experience and a passion for teaching the fundamentals of wrestling to athletes of all skill levels.',
    'https://i.pravatar.cc/400?img=1',
    '{"NCAA All-American": "2023, 2024", "ACC Champion": "2023, 2024", "Team Captain": "2024"}'::jsonb,
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

-- Emma Davis (NC State, 133 lbs)
DO $$
DECLARE
  emma_user_id UUID := '22222222-2222-2222-2222-222222222222';
  emma_email TEXT := 'emma.davis@test.levelup.com';
BEGIN
  -- Insert into public.users
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
    'Junior',
    '133',
    'Emma Davis is a standout junior wrestler at NC State, known for her exceptional technique and dedication to the sport. With multiple years of competitive experience, Emma excels at breaking down complex moves into understandable concepts. She specializes in working with youth athletes, helping them build confidence and develop strong fundamentals.',
    'https://i.pravatar.cc/400?img=5',
    '{"NCAA Qualifier": "2023, 2024", "ACC Runner-Up": "2024", "Academic All-ACC": "2023, 2024"}'::jsonb,
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

-- Marcus Lee (UNC, 174 lbs)
DO $$
DECLARE
  marcus_user_id UUID := '33333333-3333-3333-3333-333333333333';
  marcus_email TEXT := 'marcus.lee@test.levelup.com';
BEGIN
  -- Insert into public.users
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
    'Marcus Lee is a rising sophomore at UNC with a strong foundation in wrestling technique and strategy. Known for his patient teaching style and ability to adapt to different learning styles, Marcus focuses on building fundamental skills while introducing advanced concepts when athletes are ready. He has a natural ability to connect with youth wrestlers and help them reach their potential.',
    'https://i.pravatar.cc/400?img=12',
    '{"ACC Freshman of the Year": "2023", "NCAA Qualifier": "2024", "Team Most Improved": "2024"}'::jsonb,
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

-- IMPORTANT: You MUST create the auth users FIRST before running this script!
-- 
-- Option 1: Run seed-athletes-auth-users.sql first (creates auth users via SQL)
-- Option 2: Use Supabase Dashboard > Authentication > Users > Add User
--   Create users with these emails and UUIDs:
--   1. jake.miller@test.levelup.com (UUID: 11111111-1111-1111-1111-111111111111)
--   2. emma.davis@test.levelup.com (UUID: 22222222-2222-2222-2222-222222222222)
--   3. marcus.lee@test.levelup.com (UUID: 33333333-3333-3333-3333-333333333333)
-- Option 3: Use Supabase Admin API to create them programmatically
--
-- The public.users table has a foreign key to auth.users, so auth users must exist first!

-- Verify the seed data
SELECT 
  a.id,
  a.first_name,
  a.last_name,
  a.school,
  a.weight_class,
  a.average_rating,
  a.active,
  a.certifications_verified,
  u.email
FROM public.athletes a
JOIN public.users u ON a.id = u.id
WHERE a.id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ORDER BY a.average_rating DESC;

