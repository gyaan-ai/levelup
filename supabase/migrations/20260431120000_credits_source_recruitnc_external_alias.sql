-- Allow short source label `recruitnc` (RecruitNC / external clients may send this literal).
-- Canonical value for wallet transfers remains `recruitnc_transfer`; both are valid.

ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_source_check;

ALTER TABLE public.credits ADD CONSTRAINT credits_source_check CHECK (
  source IN (
    'cancellation',
    'coach_cancellation',
    'admin_grant',
    'promotion',
    'reward',
    'recruitnc_transfer',
    'recruitnc'
  )
);

COMMENT ON CONSTRAINT credits_source_check ON public.credits IS
  'credit origin: recruitnc_transfer or recruitnc = RecruitNC→Guild wallet; recruitnc is alias for external callers';
