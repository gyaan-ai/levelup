-- Helper script to create auth users for seed athletes
-- Run this FIRST before seed-athletes.sql
-- 
-- IMPORTANT: This script inserts directly into auth.users
-- This may require superuser permissions or may not work in Supabase SQL Editor
-- Alternative: Create users via Supabase Dashboard > Authentication > Users > Add User
--
-- For each user, use these exact values:
-- 1. jake.miller@test.levelup.com (UUID: 11111111-1111-1111-1111-111111111111)
-- 2. emma.davis@test.levelup.com (UUID: 22222222-2222-2222-2222-222222222222)
-- 3. marcus.lee@test.levelup.com (UUID: 33333333-3333-3333-3333-333333333333)
--
-- Password for all test users: TestPassword123!

-- Jake Miller
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'jake.miller@test.levelup.com',
  crypt('TestPassword123!', gen_salt('bf')), -- Password: TestPassword123!
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Emma Davis
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'emma.davis@test.levelup.com',
  crypt('TestPassword123!', gen_salt('bf')), -- Password: TestPassword123!
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Marcus Lee
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'marcus.lee@test.levelup.com',
  crypt('TestPassword123!', gen_salt('bf')), -- Password: TestPassword123!
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Verify auth users were created
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

