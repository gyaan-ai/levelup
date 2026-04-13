-- Partner sessions (2-athlete) are always two spots: coach + one partner's roster cap.
UPDATE public.sessions
SET max_participants = 2
WHERE session_type = '2-athlete'
  AND COALESCE(max_participants, 0) > 2;
