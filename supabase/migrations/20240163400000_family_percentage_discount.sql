-- Family (or any) percentage-off discount codes (e.g. 10% off). Distinct from early adopter free sessions.
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS percent_off INTEGER NULL CHECK (percent_off >= 1 AND percent_off <= 100);

COMMENT ON COLUMN public.discount_codes.percent_off IS 'When set, code grants this percent off at checkout (e.g. 10 = 10% off). Null = early adopter code.';

-- One row per parent: they get this percent off (from redeeming a code that has percent_off).
CREATE TABLE IF NOT EXISTS public.parent_percentage_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  percent_off INTEGER NOT NULL CHECK (percent_off >= 1 AND percent_off <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_percentage_discounts_parent
  ON public.parent_percentage_discounts(parent_id);

ALTER TABLE public.parent_percentage_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own percentage discount"
  ON public.parent_percentage_discounts FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Service role full access to parent_percentage_discounts"
  ON public.parent_percentage_discounts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.parent_percentage_discounts IS 'Parent has X% off at checkout (from redeeming a family/percentage discount code). One discount per parent.';
