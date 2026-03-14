-- Ensure GUILDLAUNCH early adopter code exists (idempotent).
-- Run this if the code is missing or you see "Code not found" when redeeming.
INSERT INTO public.discount_codes (code, name, max_redemptions)
VALUES ('GUILDLAUNCH', 'Early Adopter', 50)
ON CONFLICT (code) DO NOTHING;
