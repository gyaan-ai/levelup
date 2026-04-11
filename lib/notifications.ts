import type { SupabaseClient } from '@supabase/supabase-js';
import { logMessage } from './message-log';

type InsertNotification = {
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  /** Optional: for logging purposes */
  sessionId?: string | null;
  coachId?: string | null;
};

/**
 * Insert a notification for a user. Use admin client so we can notify any user (e.g. coach when parent books).
 * Also logs to message_log for admin visibility.
 */
export async function createNotification(
  admin: SupabaseClient,
  payload: InsertNotification
): Promise<void> {
  await admin.from('notifications').insert({
    user_id: payload.user_id,
    type: payload.type,
    title: payload.title,
    body: payload.body ?? null,
    data: payload.data ?? {},
  });
  
  // Log the notification
  void logMessage(admin, {
    channel: 'notification',
    recipientId: payload.user_id,
    messageType: payload.type,
    title: payload.title,
    body: payload.body,
    sessionId: payload.sessionId ?? (payload.data?.session_id as string) ?? null,
    coachId: payload.coachId ?? (payload.data?.coach_id as string) ?? null,
    status: 'sent',
    metadata: payload.data ?? {},
  });
}
