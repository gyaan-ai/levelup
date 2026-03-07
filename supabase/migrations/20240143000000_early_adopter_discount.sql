-- Early Adopter discount: register with a code to get 1 free private + 1 free small group (2-athlete) session.
-- Coaches are still paid by the org; parent is not charged.

-- Discount codes (one row per code; max_redemptions limits signups)
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  max_redemptions INTEGER, -- NULL = unlimited
  redemptions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entitlements granted when a parent signs up with a valid code (1 free 1-on-1, 1 free 2-athlete)
CREATE TABLE IF NOT EXISTS public.early_adopter_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('1-on-1', '2-athlete')),
  remaining INTEGER NOT NULL DEFAULT 1 CHECK (remaining >= 0),
  discount_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_early_adopter_entitlements_parent
  ON public.early_adopter_entitlements(parent_id);
CREATE INDEX IF NOT EXISTS idx_early_adopter_entitlements_parent_type
  ON public.early_adopter_entitlements(parent_id, session_type) WHERE remaining > 0;

-- Sessions can record which entitlement was used (for reporting)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS early_adopter_entitlement_id UUID REFERENCES public.early_adopter_entitlements(id) ON DELETE SET NULL;

-- RLS: parents see own entitlements; service role manages all
ALTER TABLE public.early_adopter_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own early adopter entitlements"
  ON public.early_adopter_entitlements FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Service role full access to early_adopter_entitlements"
  ON public.early_adopter_entitlements FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Discount codes: only service role (signup API) can read/update
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to discount_codes"
  ON public.discount_codes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Seed one early adopter code; change code/max_redemptions as needed
INSERT INTO public.discount_codes (code, name, max_redemptions) VALUES ('GUILDLAUNCH', 'Early Adopter', 50)
ON CONFLICT (code) DO NOTHING;
COMMENT ON TABLE public.discount_codes IS 'Codes for signup promotions (e.g. early adopter: 1 free private + 1 free small group)';
COMMENT ON TABLE public.early_adopter_entitlements IS 'Per-parent free session entitlements from discount code signup';
COMMENT ON COLUMN public.sessions.early_adopter_entitlement_id IS 'Set when session was booked using an early adopter free session';
