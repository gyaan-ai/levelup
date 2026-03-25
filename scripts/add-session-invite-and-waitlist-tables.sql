-- Add invite_token to sessions table for invite-only access
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS invite_token UUID UNIQUE DEFAULT gen_random_uuid();

-- Backfill existing sessions with invite tokens
UPDATE public.sessions 
SET invite_token = gen_random_uuid() 
WHERE invite_token IS NULL;

-- Create session_invite_access table for persistent invite access
CREATE TABLE IF NOT EXISTS public.session_invite_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_invite_access_user ON public.session_invite_access(user_id);
CREATE INDEX IF NOT EXISTS idx_session_invite_access_session ON public.session_invite_access(session_id);

ALTER TABLE public.session_invite_access ENABLE ROW LEVEL SECURITY;

-- Users can read their own access records
CREATE POLICY "Users can read own invite access"
  ON public.session_invite_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can insert (handled by API when validating token)
CREATE POLICY "Service role can insert invite access"
  ON public.session_invite_access FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create waitlist table
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT false,
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_session ON public.waitlist(session_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON public.waitlist(user_id);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Users can read their own waitlist entries
CREATE POLICY "Users can read own waitlist entries"
  ON public.waitlist FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert themselves to waitlist
CREATE POLICY "Users can join waitlist"
  ON public.waitlist FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can remove themselves from waitlist
CREATE POLICY "Users can leave waitlist"
  ON public.waitlist FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create cart_items table for Supabase-backed cart
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  athlete_id UUID REFERENCES public.youth_wrestlers(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_session ON public.cart_items(session_id);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Users can manage their own cart
CREATE POLICY "Users can read own cart"
  ON public.cart_items FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can add to cart"
  ON public.cart_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cart"
  ON public.cart_items FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can remove from cart"
  ON public.cart_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.session_invite_access IS 'Stores permanent access grants for invite-only sessions. Once user clicks valid invite link, access is stored here.';
COMMENT ON TABLE public.waitlist IS 'Users waiting for spots to open in full sessions. Position computed by row_number() ordered by created_at.';
COMMENT ON TABLE public.cart_items IS 'Supabase-backed cart for cross-device persistence. athlete_id assigned before checkout.';
COMMENT ON COLUMN public.sessions.invite_token IS 'Unique token for invite-only session access. Include in URL as ?invite=[token].';
