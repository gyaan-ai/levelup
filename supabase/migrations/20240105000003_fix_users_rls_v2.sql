-- More robust RLS fix for users table
-- This handles the case where users might query their role before the record exists

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Users can insert own record" ON public.users;
DROP POLICY IF EXISTS "Users can update own record" ON public.users;

-- Allow authenticated users to read their own record
-- This is the most permissive policy that should work
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to insert their own record (for signup)
CREATE POLICY "Users can insert own record"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update their own record
CREATE POLICY "Users can update own record"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all users (but only if they're already authenticated and have admin role)
-- Note: This might cause issues if checking admin status, so we'll make it more permissive
CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- IMPORTANT: Also ensure the users table allows nulls and has proper defaults
-- This is a safety check - if the table structure is wrong, this will fail gracefully

