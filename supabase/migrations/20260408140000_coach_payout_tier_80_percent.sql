-- Tiered coach revenue share: default remains ~83.33% (5/6 via app constants).
-- These coaches are set to 80% (0.8000) on the athlete profile and backfilled onto sessions.

UPDATE public.athletes
SET payout_rate = 0.8000
WHERE
  (
    (lower(trim(first_name)) IN ('cam', 'cameron') AND lower(trim(last_name)) = 'stinson')
    OR (lower(trim(first_name)) = 'liam' AND lower(trim(last_name)) = 'hickey')
    OR (lower(trim(last_name)) = 'sabino')
  );

UPDATE public.sessions s
SET session_payout_rate = 0.8000
FROM public.athletes a
WHERE s.athlete_id = a.id
  AND (
    (lower(trim(a.first_name)) IN ('cam', 'cameron') AND lower(trim(a.last_name)) = 'stinson')
    OR (lower(trim(a.first_name)) = 'liam' AND lower(trim(a.last_name)) = 'hickey')
    OR (lower(trim(a.last_name)) = 'sabino')
  );
