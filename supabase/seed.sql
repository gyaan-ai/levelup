-- Seed data for LevelUp database
-- Run this after the initial migration

-- Insert facilities (matches seed-athletes - use Facility, not Room, to avoid dupes)
INSERT INTO public.facilities (id, name, school, address) VALUES
  ('00000000-0000-0000-0000-000000000001', 'UNC Wrestling Facility', 'UNC', 'Chapel Hill, NC'),
  ('00000000-0000-0000-0000-000000000002', 'NC State Wrestling Facility', 'NC State', 'Raleigh, NC')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, school = EXCLUDED.school, address = EXCLUDED.address;

-- Note: To add more test data, you can:
-- 1. Create test users via Supabase Auth dashboard
-- 2. Insert athlete profiles
-- 3. Create test sessions
-- etc.





