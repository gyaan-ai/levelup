-- Roster names for public Training lists: session_participants is readable for public sessions,
-- but nested youth_wrestlers failed RLS (parents only see their own kids), so UI showed 6/6 with no names.
-- Snapshot display fields at signup so any authenticated parent can see roster without exposing phone/medical_notes.

ALTER TABLE public.session_participants
  ADD COLUMN IF NOT EXISTS roster_first_name TEXT,
  ADD COLUMN IF NOT EXISTS roster_last_name TEXT,
  ADD COLUMN IF NOT EXISTS roster_photo_url TEXT;

COMMENT ON COLUMN public.session_participants.roster_first_name IS 'Snapshot at signup for public roster UI (RLS-safe).';
COMMENT ON COLUMN public.session_participants.roster_last_name IS 'Snapshot at signup for public roster UI (RLS-safe).';
COMMENT ON COLUMN public.session_participants.roster_photo_url IS 'Snapshot at signup for roster avatars (RLS-safe).';

UPDATE public.session_participants sp
SET
  roster_first_name = yw.first_name,
  roster_last_name = yw.last_name,
  roster_photo_url = yw.photo_url
FROM public.youth_wrestlers yw
WHERE yw.id = sp.youth_wrestler_id
  AND sp.youth_wrestler_id IS NOT NULL;
