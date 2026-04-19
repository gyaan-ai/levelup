import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tenants } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';
import { formatEST } from '@/lib/format-date';

/**
 * Hourly: 12h coach nudge on pending requests; ~12h-left parent nudge on approved unpaid requests.
 * Production: CRON_SECRET + Authorization: Bearer (see purge-empty-past-sessions).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get('authorization');
  const querySecret = req.nextUrl.searchParams.get('secret');
  if (process.env.NODE_ENV === 'production') {
    const ok = secret && (auth === `Bearer ${secret}` || querySecret === secret);
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const byTenant: Record<string, { coachReminders: number; parentReminders: number }> = {};
  let coachReminders = 0;
  let parentReminders = 0;

  for (const slug of Object.keys(tenants)) {
    const admin = createAdminClient(slug);
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    let c = 0;
    let p = 0;

    const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data: pendingRows } = await admin
      .from('parent_session_requests')
      .select('id, coach_id, requesting_parent_id, preferred_datetime, session_type')
      .eq('status', 'pending')
      .is('coach_reminder_sent_at', null)
      .lte('created_at', twelveHoursAgo)
      .limit(200);

    for (const row of pendingRows || []) {
      const r = row as {
        id: string;
        coach_id: string;
        requesting_parent_id: string;
        preferred_datetime: string | null;
        session_type: string | null;
      };
      const when = r.preferred_datetime
        ? `${formatEST(new Date(r.preferred_datetime), 'EEE MMM d')} · ${formatEST(new Date(r.preferred_datetime), 'h:mm a')}`
        : 'a time they proposed';
      const typeLabel = r.session_type === 'partner' ? 'Partner' : 'Private';
      const { data: parentUser } = await admin
        .from('users')
        .select('first_name, last_name, email')
        .eq('id', r.requesting_parent_id)
        .maybeSingle();
      const parentName =
        [parentUser?.first_name, parentUser?.last_name].filter(Boolean).join(' ').trim() ||
        parentUser?.email?.split('@')[0] ||
        'A parent';

      try {
        await createNotification(admin, {
          user_id: r.coach_id,
          type: 'parent_session_request_reminder',
          title: 'Session request waiting',
          body: `Request from ${parentName} (${typeLabel}, ${when}) — expires soon. Open Schedule to approve, counter, or decline.`,
          data: {
            requestId: r.id,
            link: `${baseUrl}/athlete-dashboard`,
            coachId: r.coach_id,
          },
          coachId: r.coach_id,
        });
        await admin
          .from('parent_session_requests')
          .update({ coach_reminder_sent_at: new Date().toISOString() })
          .eq('id', r.id)
          .eq('status', 'pending');
        c++;
      } catch (e) {
        console.error(`session-request-reminders coach ${slug} ${r.id}`, e);
      }
    }

    const now = Date.now();
    const twelveH = 12 * 3600 * 1000;
    const { data: payRows } = await admin
      .from('parent_session_requests')
      .select('id, requesting_parent_id, coach_id, payment_deadline_at, created_session_id')
      .eq('status', 'approved')
      .not('payment_deadline_at', 'is', null)
      .not('created_session_id', 'is', null)
      .is('parent_pay_reminder_sent_at', null)
      .limit(200);

    for (const row of payRows || []) {
      const r = row as {
        id: string;
        requesting_parent_id: string;
        coach_id: string;
        payment_deadline_at: string;
        created_session_id: string | null;
      };
      const deadline = new Date(r.payment_deadline_at).getTime();
      const remaining = deadline - now;
      // First reminder once we're inside the final 12h window (one send per request via flag)
      if (remaining <= 0 || remaining > twelveH) continue;

      const { data: coachAthlete } = await admin
        .from('athletes')
        .select('first_name, last_name')
        .eq('id', r.coach_id)
        .maybeSingle();
      const coachName =
        [coachAthlete?.first_name, coachAthlete?.last_name].filter(Boolean).join(' ').trim() || 'your coach';

      try {
        await createNotification(admin, {
          user_id: r.requesting_parent_id,
          type: 'parent_session_payment_reminder',
          title: 'Complete your booking',
          body: `Less than 12 hours left to complete booking with ${coachName}. Finish checkout to hold your spot.`,
          data: {
            requestId: r.id,
            link: `${baseUrl}/cart/checkout`,
            sessionId: r.created_session_id,
          },
        });
        await admin
          .from('parent_session_requests')
          .update({ parent_pay_reminder_sent_at: new Date().toISOString() })
          .eq('id', r.id)
          .eq('status', 'approved');
        p++;
      } catch (e) {
        console.error(`session-request-reminders parent ${slug} ${r.id}`, e);
      }
    }

    byTenant[slug] = { coachReminders: c, parentReminders: p };
    coachReminders += c;
    parentReminders += p;
  }

  return NextResponse.json({ ok: true, coachReminders, parentReminders, byTenant });
}
