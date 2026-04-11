-- Coach onboarding fields migration
-- Adds status tracking and additional coach application fields

-- Add status column for coach approval workflow
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add constraint for status values (pending for new, active for approved, rejected, suspended)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'athletes_status_check'
  ) THEN
    ALTER TABLE athletes ADD CONSTRAINT athletes_status_check 
      CHECK (status IN ('pending', 'active', 'rejected', 'suspended'));
  END IF;
END $$;

-- Agreement tracking
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMPTZ;

-- Emergency contact info
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;

-- T-shirt size for gear
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS tshirt_size TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'athletes_tshirt_size_check'
  ) THEN
    ALTER TABLE athletes ADD CONSTRAINT athletes_tshirt_size_check 
      CHECK (tshirt_size IS NULL OR tshirt_size IN ('S', 'M', 'L', 'XL', 'XXL'));
  END IF;
END $$;

-- Admin notes and rejection tracking
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- Date of birth (for age verification)
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Set existing coaches to 'active' status so they aren't affected
UPDATE athletes SET status = 'active' WHERE status IS NULL;

-- Create index for admin queries on pending applications
CREATE INDEX IF NOT EXISTS idx_athletes_status ON athletes(status);
CREATE INDEX IF NOT EXISTS idx_athletes_reviewed_at ON athletes(reviewed_at);
