-- Create the FAMILY10 discount code (10% off all sessions). Idempotent.
INSERT INTO public.discount_codes (code, name, max_redemptions, percent_off)
VALUES ('FAMILY10', 'Family 10% off', NULL, 10)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  percent_off = EXCLUDED.percent_off,
  updated_at = NOW();
