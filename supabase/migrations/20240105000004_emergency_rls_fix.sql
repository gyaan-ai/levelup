-- Emergency RLS fix - Simple and direct
-- This ensures authenticated users can always read their own record

-- First, drop all existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
DROP POLICY IF EXISTS "Users can update own record" ON public.users;

-- Simple policy: authenticated users can read their own record
-- No complex EXISTS checks that might cause issues
CREATE POLICY "authenticated_users_read_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to insert their own record
CREATE POLICY "authenticated_users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update their own record
CREATE POLICY "authenticated_users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- For admins reading all users, we'll use a service role check later if needed
-- For now, the above policies should allow basic operations

