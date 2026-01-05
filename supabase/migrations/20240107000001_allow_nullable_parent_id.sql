-- Allow parent_id to be nullable for youth wrestlers who manage their own accounts
ALTER TABLE public.youth_wrestlers 
ALTER COLUMN parent_id DROP NOT NULL;

-- Update RLS policies to allow youth wrestlers to manage their own profiles
-- Drop existing policies
DROP POLICY IF EXISTS "Parents can view own youth wrestlers" ON public.youth_wrestlers;
DROP POLICY IF EXISTS "Parents can insert own youth wrestlers" ON public.youth_wrestlers;
DROP POLICY IF EXISTS "Parents can update own youth wrestlers" ON public.youth_wrestlers;
DROP POLICY IF EXISTS "Parents can delete own youth wrestlers" ON public.youth_wrestlers;

-- Recreate policies to allow both parents and youth wrestlers to manage profiles
CREATE POLICY "Parents can view own youth wrestlers"
  ON public.youth_wrestlers FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    (id = auth.uid() AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'youth_wrestler'))
  );

CREATE POLICY "Parents can insert own youth wrestlers"
  ON public.youth_wrestlers FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = auth.uid() OR
    (id = auth.uid() AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'youth_wrestler'))
  );

CREATE POLICY "Parents can update own youth wrestlers"
  ON public.youth_wrestlers FOR UPDATE
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    (id = auth.uid() AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'youth_wrestler'))
  )
  WITH CHECK (
    parent_id = auth.uid() OR
    (id = auth.uid() AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'youth_wrestler'))
  );

CREATE POLICY "Parents can delete own youth wrestlers"
  ON public.youth_wrestlers FOR DELETE
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    (id = auth.uid() AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'youth_wrestler'))
  );

