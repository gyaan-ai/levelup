-- Youth Wrestlers Migration
-- Adds support for parents to manage profiles for their youth wrestlers

-- Create youth_wrestlers table
CREATE TABLE IF NOT EXISTS public.youth_wrestlers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  age INTEGER,
  school TEXT,
  grade TEXT,
  weight_class TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'elite')),
  wrestling_experience TEXT, -- e.g., "3 years", "first year"
  goals TEXT, -- what they want to work on
  medical_notes TEXT, -- injuries, allergies, etc.
  photo_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_youth_wrestlers_parent ON public.youth_wrestlers(parent_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_youth_wrestlers_updated_at ON public.youth_wrestlers;
CREATE TRIGGER update_youth_wrestlers_updated_at BEFORE UPDATE ON public.youth_wrestlers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.youth_wrestlers ENABLE ROW LEVEL SECURITY;

-- Policy: Parents can view their own youth wrestlers
DROP POLICY IF EXISTS "Parents can view own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can view own youth wrestlers"
  ON public.youth_wrestlers FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid()
  );

-- Policy: Parents can insert their own youth wrestlers
DROP POLICY IF EXISTS "Parents can insert own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can insert own youth wrestlers"
  ON public.youth_wrestlers FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = auth.uid()
  );

-- Policy: Parents can update their own youth wrestlers
DROP POLICY IF EXISTS "Parents can update own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can update own youth wrestlers"
  ON public.youth_wrestlers FOR UPDATE
  TO authenticated
  USING (
    parent_id = auth.uid()
  )
  WITH CHECK (
    parent_id = auth.uid()
  );

-- Policy: Parents can delete their own youth wrestlers
DROP POLICY IF EXISTS "Parents can delete own youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Parents can delete own youth wrestlers"
  ON public.youth_wrestlers FOR DELETE
  TO authenticated
  USING (
    parent_id = auth.uid()
  );

-- Policy: Athletes and admins can view youth wrestlers (for booking purposes)
DROP POLICY IF EXISTS "Athletes can view youth wrestlers" ON public.youth_wrestlers;
CREATE POLICY "Athletes can view youth wrestlers"
  ON public.youth_wrestlers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('athlete', 'admin')
    )
  );

-- Add youth_wrestler_id to sessions table
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS youth_wrestler_id UUID REFERENCES public.youth_wrestlers(id) ON DELETE SET NULL;

-- Add index for sessions youth_wrestler_id
CREATE INDEX IF NOT EXISTS idx_sessions_youth_wrestler ON public.sessions(youth_wrestler_id);

