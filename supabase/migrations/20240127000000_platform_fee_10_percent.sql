-- Platform take: 10% of parent price. Stripe fee is paid from that 10% (not from coach payout).
-- Update existing products to 90% coach / 10% platform split.
UPDATE public.products
SET athlete_payout = ROUND(parent_price * 0.9, 2)
WHERE slug IN ('private', 'partner', 'small-group');

COMMENT ON TABLE public.products IS 'Session product SKUs with pricing breakdown. Platform take is 10% of parent price; Stripe is paid from that 10%.';
