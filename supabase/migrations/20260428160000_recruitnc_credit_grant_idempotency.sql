-- RecruitNC → Guild server-to-server credit grants: idempotent responses by Idempotency-Key (allocation id).
-- Service role only for writes; no public access.

CREATE TABLE IF NOT EXISTS public.recruitnc_credit_grant_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.recruitnc_credit_grant_idempotency IS
  'Caches 200 JSON per Idempotency-Key; null response_json means claim held, grant in progress';

CREATE INDEX IF NOT EXISTS idx_recruitnc_grant_idem_created ON public.recruitnc_credit_grant_idempotency (created_at);

ALTER TABLE public.recruitnc_credit_grant_idempotency ENABLE ROW LEVEL SECURITY;

-- No JWT policy: only service_role (bypasses RLS) inserts/updates from trusted API route.
