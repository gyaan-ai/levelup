-- Set price_per_participant = 30 for ALL joinable small-group sessions that have no price.
-- Run in Supabase SQL editor. Fixes "free - early adopter" showing when we're charging.
-- (Does not change sessions that already have a price set.)

UPDATE public.sessions
SET price_per_participant = 30,
    updated_at = NOW()
WHERE partner_invite_code IS NOT NULL
  AND partner_invite_code != ''
  AND (price_per_participant IS NULL OR price_per_participant <= 0)
  AND (
    max_participants >= 2
    OR session_type IN ('group', '2-athlete', 'small_group')
  );
