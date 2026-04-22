-- Referral credits: default hold before release is 3 days (new inserts only).
-- Application code sets available_at explicitly; this aligns DB default if omitted.
ALTER TABLE public.pending_referral_credits
  ALTER COLUMN available_at SET DEFAULT (NOW() + INTERVAL '3 days');

COMMENT ON COLUMN public.pending_referral_credits.available_at IS
  'When the credit may be released; typically first booking time + 3 days.';
