-- RecruitNC allocations into Guild wallets: dedicated source for admin reporting.

ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_source_check;

ALTER TABLE public.credits ADD CONSTRAINT credits_source_check CHECK (
  source IN (
    'cancellation',
    'coach_cancellation',
    'admin_grant',
    'promotion',
    'reward',
    'recruitnc_transfer'
  )
);

COMMENT ON CONSTRAINT credits_source_check ON public.credits IS
  'recruitnc_transfer = funds moved from RecruitNC fundraising ledger into Guild wallet credits';
