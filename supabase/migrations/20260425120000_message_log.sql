-- Outgoing SMS and in-app notification audit trail (admin Message log UI).

CREATE TABLE IF NOT EXISTS public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL CHECK (channel IN ('sms', 'notification')),
  recipient_id uuid,
  recipient_phone text,
  recipient_label text,
  message_type text NOT NULL,
  title text,
  body text,
  session_id uuid,
  coach_id uuid,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_detail text,
  metadata jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.message_log IS 'Audit log of outbound SMS and in-app notifications for admin review.';

CREATE INDEX IF NOT EXISTS idx_message_log_created_at ON public.message_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_log_channel ON public.message_log (channel);
CREATE INDEX IF NOT EXISTS idx_message_log_message_type ON public.message_log (message_type);
CREATE INDEX IF NOT EXISTS idx_message_log_session_id ON public.message_log (session_id);

ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;

-- No direct client access; service role / server admin client bypasses RLS for inserts and API reads.
