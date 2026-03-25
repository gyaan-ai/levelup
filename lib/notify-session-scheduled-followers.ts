import { createAdminClient } from '@/lib/supabase/admin';
import { createNotification } from '@/lib/notifications';
import { normalizePhone, sendSms } from '@/lib/twilio';
import { formatEST } from '@/lib/format-date';

/**
 * Notify parents who follow this coach: in-app notification + SMS (if parent has users.phone).
 * Call when a new bookable session is published (e.g. admin-created group session with join link).
 */
export async function notifySessionScheduledFollowers(
  tenantSlug: string,
  coachId: string,
  opts: {
    sessionId: string;
    scheduledDatetime: string;
    /** e.g. /join/ABC123 — combined with NEXT_PUBLIC_APP_URL for SMS */
    joinUrlPath: string;
  }
): Promise<void> {
  try {
    const admin = createAdminClient(tenantSlug);
    const { data: follows } = await admin
      .from('coach_follows')
      .select('parent_id')
      .eq('coach_id', coachId);
    if (!follows?.length) return;

    const { data: coach } = await admin
      .from('athletes')
      .select('first_name, last_name')
      .eq('id', coachId)
      .single();
    const coachName = coach
      ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim()
      : 'A coach you follow';

    const when = formatEST(new Date(opts.scheduledDatetime), 'EEE MMM d · h:mm a');
    const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const path = opts.joinUrlPath.startsWith('/') ? opts.joinUrlPath : `/${opts.joinUrlPath}`;
    const link = base ? `${base}${path}` : path;

    const title = `New session: ${coachName}`;
    const body = `${coachName} scheduled a session (${when}). Tap to book!`;
    // Link directly to the session detail page
    const sessionLink = `/sessions/${opts.sessionId}`;

    await Promise.all(
      follows.map((f) =>
        createNotification(admin, {
          user_id: f.parent_id,
          type: 'coach_new_session',
          title,
          body,
          data: {
            coach_id: coachId,
            session_id: opts.sessionId,
            link: sessionLink,
          },
        })
      )
    );

    const parentIds = [...new Set(follows.map((f) => f.parent_id))];
    const { data: parents } = await admin.from('users').select('id, phone').in('id', parentIds);

    const smsBody = `${coachName}: new session ${when}. Book: ${link}`.slice(0, 1600);
    const sentPhones = new Set<string>();
    for (const p of parents ?? []) {
      const phone = normalizePhone(p.phone ?? undefined);
      if (!phone || sentPhones.has(phone)) continue;
      sentPhones.add(phone);
      void sendSms(phone, smsBody);
    }
  } catch (e) {
    console.warn('notifySessionScheduledFollowers failed:', e);
  }
}
