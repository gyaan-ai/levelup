-- Payout contact info for manual payouts (Venmo / Zelle)
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS venmo_handle TEXT,
  ADD COLUMN IF NOT EXISTS zelle_email TEXT;

COMMENT ON COLUMN public.athletes.venmo_handle IS 'Venmo username for coach payouts (Option A manual)';
COMMENT ON COLUMN public.athletes.zelle_email IS 'Email or phone linked to Zelle for coach payouts (Option A manual)';
