-- Store Vercel Web Analytics drain events so the cockpit can show visitor/pageview counts.
-- Vercel POSTs batches to /api/admin/vercel-analytics-drain; we persist and aggregate by date.
CREATE TABLE IF NOT EXISTS public.vercel_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  event_type TEXT NOT NULL,
  event_name TEXT,
  timestamp_ms BIGINT NOT NULL,
  device_id BIGINT,
  session_id BIGINT,
  path TEXT,
  origin TEXT,
  project_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_vercel_analytics_events_timestamp_ms
  ON public.vercel_analytics_events (timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_vercel_analytics_events_origin
  ON public.vercel_analytics_events (origin);

COMMENT ON TABLE public.vercel_analytics_events IS 'Events from Vercel Web Analytics Drain for cockpit visitor/pageview counts.';
