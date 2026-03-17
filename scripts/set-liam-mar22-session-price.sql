-- Set price per participant for Liam's March 22 small group (invite code Z8MQDWSL).
-- Run in Supabase SQL editor. Ensures the session is treated as paid so "free" (GUILDLAUNCH) doesn't apply.

UPDATE public.sessions
SET price_per_participant = 30,
    updated_at = NOW()
WHERE partner_invite_code = 'Z8MQDWSL'
  AND (price_per_participant IS NULL OR price_per_participant <= 0);
