-- Allow pausing discount codes so they can't be used at signup or redeem (e.g. GUILDLAUNCH).
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.discount_codes.active IS 'When false, code cannot be used at signup or redeem (paused).';

-- Optionally pause GUILDLAUNCH now (uncomment to run):
-- UPDATE public.discount_codes SET active = false WHERE code = 'GUILDLAUNCH';
