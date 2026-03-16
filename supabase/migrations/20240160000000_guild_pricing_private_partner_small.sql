-- Guild pricing: default product template (parent_price, athlete_payout) per session type.
-- Coaches can still customize rates via athlete_services (rate card), where guild share is 1/6 (~17%)
-- (athlete_payout = parent_price * 5/6). athlete_products.custom_parent_price / custom_athlete_payout
-- also allow per-coach overrides when using products. This migration only sets the org default rows.
-- Parents see: Private $60, Partner $45/athlete, Small group $30/athlete.
-- Default split: Private 60/50/10, Partner 45×2=90 → 75/15, Small 30×6=180 → 150/30 ($5/athlete guild).

UPDATE public.products
SET
  parent_price = 60.00,
  athlete_payout = 50.00,
  min_participants = 1,
  max_participants = 1,
  name = '1:1 Private Session',
  description = 'One-on-one instruction with a college wrestler.'
WHERE slug = 'private';

UPDATE public.products
SET
  parent_price = 45.00,
  athlete_payout = 37.50,
  min_participants = 2,
  max_participants = 2,
  name = 'Partner Session (1:2)',
  description = 'Train with a partner and split the cost.'
WHERE slug = 'partner';

UPDATE public.products
SET
  parent_price = 30.00,
  athlete_payout = 25.00,
  min_participants = 3,
  max_participants = 6,
  name = 'Small Group Session (Max 6)',
  description = 'Small group technique session.'
WHERE slug = 'small-group';

COMMENT ON COLUMN public.products.athlete_payout IS 'Payout per participant to coach. Private $50 total, Partner $75 total (37.50×2), Small group $150 at 6 (25×6). Guild takes remainder; Stripe from guild.';
