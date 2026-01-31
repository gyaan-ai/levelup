-- Products/SKUs system for session pricing
-- Allows admin to define products with pricing breakdown
-- Athletes can choose which products they offer

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'private', 'partner', 'small-group'
  name TEXT NOT NULL, -- '1:1 Private Session'
  description TEXT,
  
  -- Pricing breakdown (all in USD)
  parent_price DECIMAL(10,2) NOT NULL, -- What parent pays per participant
  athlete_payout DECIMAL(10,2) NOT NULL, -- What coach receives per participant
  stripe_fee_percent DECIMAL(5,4) DEFAULT 0.029, -- 2.9%
  stripe_fee_fixed DECIMAL(10,2) DEFAULT 0.30, -- $0.30
  
  -- Participant limits
  min_participants INTEGER NOT NULL DEFAULT 1,
  max_participants INTEGER NOT NULL DEFAULT 1,
  
  -- Status
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Athlete products junction table
CREATE TABLE IF NOT EXISTS public.athlete_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Optional athlete-specific overrides (NULL = use product defaults)
  custom_parent_price DECIMAL(10,2),
  custom_athlete_payout DECIMAL(10,2),
  
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(athlete_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_athlete_products_athlete ON public.athlete_products(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_products_product ON public.athlete_products(product_id);

-- RLS policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_products ENABLE ROW LEVEL SECURITY;

-- Everyone can view active products
CREATE POLICY "Anyone can view active products"
  ON public.products FOR SELECT
  USING (active = true);

-- Admins can manage all products
CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role full access
CREATE POLICY "Service role full access to products"
  ON public.products FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Athletes can view their own product settings
CREATE POLICY "Athletes can view own products"
  ON public.athlete_products FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE id = auth.uid()
    )
  );

-- Athletes can manage their own product settings
CREATE POLICY "Athletes can manage own products"
  ON public.athlete_products FOR ALL
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE id = auth.uid()
    )
  );

-- Admins can view all athlete products
CREATE POLICY "Admins can view all athlete products"
  ON public.athlete_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role full access
CREATE POLICY "Service role full access to athlete_products"
  ON public.athlete_products FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Parents can view athlete products for booking
CREATE POLICY "Parents can view athlete products"
  ON public.athlete_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('parent', 'admin')
    )
  );

-- Insert default products
INSERT INTO public.products (slug, name, description, parent_price, athlete_payout, min_participants, max_participants, display_order)
VALUES
  ('private', '1:1 Private Session', 'One-on-one instruction with a college wrestler', 60.00, 50.00, 1, 1, 1),
  ('partner', 'Partner Session (1:2)', 'Train with a workout partner, split the cost', 40.00, 32.00, 2, 2, 2),
  ('small-group', 'Small Group (3-5)', 'Small group training session', 30.00, 24.00, 3, 5, 3)
ON CONFLICT (slug) DO NOTHING;

-- Function to calculate expected fees and net
CREATE OR REPLACE FUNCTION public.calculate_product_fees(
  p_parent_price DECIMAL,
  p_athlete_payout DECIMAL,
  p_participants INTEGER DEFAULT 1,
  p_stripe_fee_percent DECIMAL DEFAULT 0.029,
  p_stripe_fee_fixed DECIMAL DEFAULT 0.30
)
RETURNS TABLE (
  total_parent_price DECIMAL,
  total_athlete_payout DECIMAL,
  stripe_fee DECIMAL,
  guild_net DECIMAL
) AS $$
BEGIN
  RETURN QUERY SELECT
    p_parent_price * p_participants AS total_parent_price,
    p_athlete_payout * p_participants AS total_athlete_payout,
    ROUND((p_parent_price * p_participants * p_stripe_fee_percent) + p_stripe_fee_fixed, 2) AS stripe_fee,
    ROUND(
      (p_parent_price * p_participants) - 
      (p_athlete_payout * p_participants) - 
      ((p_parent_price * p_participants * p_stripe_fee_percent) + p_stripe_fee_fixed),
      2
    ) AS guild_net;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add product_id to sessions table for tracking
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- Comments
COMMENT ON TABLE public.products IS 'Session product SKUs with pricing breakdown';
COMMENT ON TABLE public.athlete_products IS 'Which products each athlete offers';
COMMENT ON COLUMN public.products.parent_price IS 'Price per participant charged to parent';
COMMENT ON COLUMN public.products.athlete_payout IS 'Payout per participant to athlete/coach';
COMMENT ON COLUMN public.athlete_products.custom_parent_price IS 'Optional athlete-specific price override';
