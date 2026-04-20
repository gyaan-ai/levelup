-- Force Guild standard parent rates on every active coach offering (all durations).
-- Fixes profiles still showing legacy partner $45 / private $75 when only non-60m rows were wrong,
-- or when athlete_products.custom_parent_price kept old amounts.

UPDATE public.products
SET
  parent_price = 60.00,
  athlete_payout = 48.00,
  updated_at = NOW()
WHERE slug = 'private';

UPDATE public.products
SET
  parent_price = 50.00,
  athlete_payout = 40.00,
  updated_at = NOW()
WHERE slug = 'partner';

UPDATE public.products
SET
  parent_price = 30.00,
  athlete_payout = 24.00,
  updated_at = NOW()
WHERE slug = 'small-group';

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
  ),
  updated_at = NOW()
WHERE active = true
  AND session_type IN ('private', 'partner', 'small_group');

UPDATE public.athlete_products ap
SET
  custom_parent_price = NULL,
  custom_athlete_payout = NULL,
  updated_at = NOW()
FROM public.products p
WHERE ap.product_id = p.id
  AND p.slug IN ('private', 'partner', 'small-group')
  AND ap.enabled = true;
