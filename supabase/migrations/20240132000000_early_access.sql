-- Early access / waitlist signups from the homepage (testers, early adopters).
CREATE TABLE IF NOT EXISTS public.early_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  interest TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_early_access_created ON public.early_access(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_early_access_email_lower ON public.early_access(LOWER(TRIM(email)));

ALTER TABLE public.early_access ENABLE ROW LEVEL SECURITY;

-- No public policies: API uses service role to insert. Admins can read via service role or add a policy later.
COMMENT ON TABLE public.early_access IS 'Homepage early access signups (testers, early adopters). Insert via API only.';
