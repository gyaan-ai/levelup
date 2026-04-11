import type { SupabaseClient } from '@supabase/supabase-js';

export type MessageChannel = 'sms' | 'notification';
export type MessageStatus = 'sent' | 'failed' | 'pending';

export type LogMessageParams = {
  channel: MessageChannel;
  recipientId?: string | null;
  recipientPhone?: string | null;
  recipientLabel?: string | null;
  messageType: string;
  title?: string | null;
  body?: string | null;
  sessionId?: string | null;
  coachId?: string | null;
  status?: MessageStatus;
  errorDetail?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Log an outgoing message (SMS or notification) to the message_log table.
 */
export async function logMessage(
  admin: SupabaseClient,
  params: LogMessageParams
): Promise<void> {
  try {
    await admin.from('message_log').insert({
      channel: params.channel,
      recipient_id: params.recipientId ?? null,
      recipient_phone: params.recipientPhone ?? null,
      recipient_label: params.recipientLabel ?? null,
      message_type: params.messageType,
      title: params.title ?? null,
      body: params.body ?? null,
      session_id: params.sessionId ?? null,
      coach_id: params.coachId ?? null,
      status: params.status ?? 'sent',
      error_detail: params.errorDetail ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (e) {
    // Don't let logging failures break the main flow
    console.warn('Failed to log message:', e);
  }
}

/**
 * Log multiple messages in bulk (for group SMS/notifications).
 */
export async function logMessages(
  admin: SupabaseClient,
  messages: LogMessageParams[]
): Promise<void> {
  if (messages.length === 0) return;
  try {
    await admin.from('message_log').insert(
      messages.map((m) => ({
        channel: m.channel,
        recipient_id: m.recipientId ?? null,
        recipient_phone: m.recipientPhone ?? null,
        recipient_label: m.recipientLabel ?? null,
        message_type: m.messageType,
        title: m.title ?? null,
        body: m.body ?? null,
        session_id: m.sessionId ?? null,
        coach_id: m.coachId ?? null,
        status: m.status ?? 'sent',
        error_detail: m.errorDetail ?? null,
        metadata: m.metadata ?? {},
      }))
    );
  } catch (e) {
    console.warn('Failed to log messages:', e);
  }
}
