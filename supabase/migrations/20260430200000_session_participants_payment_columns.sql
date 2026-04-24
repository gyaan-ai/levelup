-- App inserts (cart, register credit-only, book-a-coach credit) use payment_method + status.
-- Stripe webhook inserts stripe_payment_intent_id + stripe_fee. Ensure columns exist in all envs.

ALTER TABLE public.session_participants
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_fee DECIMAL(10,2);

COMMENT ON COLUMN public.session_participants.payment_method IS 'How the spot was paid: credit, stripe, cash, etc.';
COMMENT ON COLUMN public.session_participants.status IS 'Optional roster state, e.g. confirmed for credit checkouts.';
COMMENT ON COLUMN public.session_participants.stripe_payment_intent_id IS 'Stripe PaymentIntent id when paid by card.';
COMMENT ON COLUMN public.session_participants.stripe_fee IS 'Stripe processing fee (USD) attributed to this row when known.';
