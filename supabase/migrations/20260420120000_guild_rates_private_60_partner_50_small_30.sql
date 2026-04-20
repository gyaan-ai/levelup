-- Guild default parent rates: private $60, partner $50/person, small group $30/person.
-- Coach payout = 80% of parent_price (matches lib/pricing coachPayoutFromParentPrice).

UPDATE public.products
SET
  parent_price = 60.00,
  athlete_payout = 48.00,
  min_participants = 1,
  max_participants = 1,
  name = '1:1 Private Session',
  description = 'One-on-one instruction with a college wrestler.'
WHERE slug = 'private';

UPDATE public.products
SET
  parent_price = 50.00,
  athlete_payout = 40.00,
  min_participants = 2,
  max_participants = 2,
  name = 'Partner Session (1:2)',
  description = 'Train with a partner and split the cost.'
WHERE slug = 'partner';

UPDATE public.products
SET
  parent_price = 30.00,
  athlete_payout = 24.00,
  min_participants = 3,
  max_participants = 6,
  name = 'Small Group Session (Max 6)',
  description = 'Small group technique session.'
WHERE slug = 'small-group';

-- Align 1-hour offerings with the same defaults (coaches can still change on /rate-card).
UPDATE public.athlete_services
SET
  parent_price = CASE session_type
    WHEN 'private' THEN 60.00
    WHEN 'partner' THEN 50.00
    WHEN 'small_group' THEN 30.00
    ELSE parent_price
  END,
  athlete_payout = ROUND(
    (CASE session_type
      WHEN 'private' THEN 60.00
      WHEN 'partner' THEN 50.00
      WHEN 'small_group' THEN 30.00
      ELSE parent_price
    END * 0.8)::numeric,
    2
  )
WHERE duration_minutes = 60
  AND session_type IN ('private', 'partner', 'small_group');
