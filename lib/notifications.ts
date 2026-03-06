import type { SupabaseClient } from '@supabase/supabase-js';

type InsertNotification = {
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
};

/**
 * Insert a notification for a user. Use admin client so we can notify any user (e.g. coach when parent books).
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
}
