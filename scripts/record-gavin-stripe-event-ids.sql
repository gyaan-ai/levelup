-- One-off: Use exact IDs from Stripe checkout.session.completed event (Mar 16, 2026, 2:45 PM).
-- Event had metadata: session_id, youth_wrestler_id, parent_id; webhook returned 200 but participant may not show if DB/env mismatch.
-- Run in Supabase SQL Editor.

-- Optional: Check if participant already exists (run first to inspect)
-- SELECT * FROM public.session_participants WHERE session_id = 'dbc1a848-1b52-4b74-8adb-4c4de850e83e';

-- Step 1: Insert or update participant with exact IDs from Stripe event
INSERT INTO public.session_participants (session_id, youth_wrestler_id, parent_id, paid, amount_paid)
VALUES (
  'dbc1a848-1b52-4b74-8adb-4c4de850e83e',
  'c376fb90-eb3e-4ea8-a7ee-4b6dc4fb59d7',
  '03d6216f-ec85-4f15-877c-e505aa5f544f',
  true,
  30.00
)
ON CONFLICT (session_id, youth_wrestler_id) DO UPDATE
SET paid = true, amount_paid = 30.00;

-- Step 2: Set current_participants for this session from actual count
UPDATE public.sessions
SET current_participants = (
  SELECT count(*)::int FROM public.session_participants WHERE session_id = 'dbc1a848-1b52-4b74-8adb-4c4de850e83e'
),
updated_at = now()
WHERE id = 'dbc1a848-1b52-4b74-8adb-4c4de850e83e';
