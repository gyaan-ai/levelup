-- Message log table to track all outgoing notifications and SMS
CREATE TABLE IF NOT EXISTS message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Message type: 'sms' or 'notification' (in-app alert)
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'notification')),
  
  -- Who received it
  recipient_id UUID, -- user_id if known
  recipient_phone TEXT, -- for SMS
  recipient_label TEXT, -- human-readable label like "Parent: john@example.com (Gavin)"
  
  -- Message content
  message_type TEXT NOT NULL, -- e.g. 'session_booked', 'coach_new_session', 'group_sms', etc.
  title TEXT,
  body TEXT,
  
  -- Context
  session_id UUID, -- if related to a session
  coach_id UUID, -- if related to a coach
  
  -- Status
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_detail TEXT,
  
  -- Extra metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for querying by date and type
CREATE INDEX IF NOT EXISTS idx_message_log_created_at ON message_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_log_channel ON message_log (channel);
CREATE INDEX IF NOT EXISTS idx_message_log_message_type ON message_log (message_type);
CREATE INDEX IF NOT EXISTS idx_message_log_session_id ON message_log (session_id);
