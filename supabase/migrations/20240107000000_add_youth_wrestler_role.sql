-- Add youth_wrestler role to users table
-- This allows youth wrestlers to create their own accounts

-- First, drop the existing CHECK constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the new constraint with youth_wrestler role
ALTER TABLE public.users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('parent', 'athlete', 'admin', 'youth_wrestler'));





