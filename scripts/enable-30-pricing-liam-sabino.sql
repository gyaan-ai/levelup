-- One-time: set $30 pricing on existing Liam/Sabino sessions (so Stripe charges at join/register).
-- New sessions get price from the coach rate card (Admin → Create session uses small-group product / athlete_products).
-- Run in Supabase SQL Editor. Then set STRIPE_CHECKOUT_ENABLED=true in your env.
--
-- Liam   = 094c9330-0cd5-4ff2-a83f-4c4ae9b0796a
-- Sabino = 47446177-80e9-4381-9de0-8fd5abb15cb0

UPDATE public.sessions
SET price_per_participant = 30,
    updated_at = now()
WHERE athlete_id IN (
  '094c9330-0cd5-4ff2-a83f-4c4ae9b0796a',  -- Liam
  '47446177-80e9-4381-9de0-8fd5abb15cb0'   -- Sabino
)
  AND (price_per_participant IS NULL OR price_per_participant = 0);

-- Optional: see how many sessions were updated
-- SELECT count(*) FROM public.sessions
-- WHERE athlete_id IN ('094c9330-0cd5-4ff2-a83f-4c4ae9b0796a','47446177-80e9-4381-9de0-8fd5abb15cb0');
