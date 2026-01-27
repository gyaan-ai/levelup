-- Seed data for LevelUp database
-- Run this after the initial migration

-- Insert facilities (from tenant config)
INSERT INTO public.facilities (name, school) VALUES
  ('UNC Wrestling Room', 'UNC'),
  ('NC State Wrestling Room', 'NC State')
ON CONFLICT DO NOTHING;

-- Note: To add more test data, you can:
-- 1. Create test users via Supabase Auth dashboard
-- 2. Insert athlete profiles
-- 3. Create test sessions
-- etc.





