-- Pause the GUILDLAUNCH discount code so it can't be used at signup or redeem.
-- Run after applying migration 20240163300000_discount_codes_active.sql.
UPDATE public.discount_codes
SET active = false, updated_at = NOW()
WHERE code = 'GUILDLAUNCH';
