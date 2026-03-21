-- Make a session show up on Training / browse (join_policy = public).
-- Link-only sessions use invite_only and will NOT appear on Training — only via shared URL.
--
-- Edit the UUID below if this is a different session (must be a valid UUID string).

UPDATE public.sessions
SET join_policy = 'public',
    updated_at = NOW()
WHERE id = 'dbc1a848-1b52-4b74-8adb-4c4de850e83e';

-- Verify:
-- SELECT id, join_policy, scheduled_datetime, current_participants, max_participants, status
-- FROM public.sessions
-- WHERE id = 'dbc1a848-1b52-4b74-8adb-4c4de850e83e';
