import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { sendSessionSms } from '@/lib/session-group-sms';

const MAX_LEN = 1200;

/**
 * POST — coach (or admin) sends an SMS to each parent in this session (unique phones).
 * Body: { message, target?: string, audience?: 'parents'|'athletes'|'both' (legacy) }
 * target: broadcast:parents | broadcast:athletes | broadcast:both | parent:<uuid> | athlete:<uuid>
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const role = userData?.role;
    if (role !== 'coach' && role !== 'admin') {
      return NextResponse.json({ error: 'Only coaches can text the group' }, { status: 403 });
    }

    const body = (await req.json()) as { message?: string; audience?: string; target?: string };
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    let target =
      typeof body.target === 'string' && body.target.trim() ? body.target.trim() : '';
    if (!target && typeof body.audience === 'string') {
      const a = body.audience.toLowerCase();
      if (a === 'athletes' || a === 'both' || a === 'parents') target = `broadcast:${a}`;
    }
    if (!target) target = 'broadcast:parents';
    if (message.length > MAX_LEN) {
      return NextResponse.json({ error: `Message must be ${MAX_LEN} characters or less` }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: session, error: sessErr } = await admin
      .from('sessions')
      .select('id, athlete_id, scheduled_datetime, status')
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const athleteId = (session as { athlete_id?: string }).athlete_id;
    if (role !== 'admin' && athleteId !== user.id) {
      return NextResponse.json({ error: 'You can only text groups for your own sessions' }, { status: 403 });
    }

    if (!['scheduled', 'pending_payment'].includes((session as { status?: string }).status ?? '')) {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
    }

    const dt = new Date((session as { scheduled_datetime: string }).scheduled_datetime);
    if (dt.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Session is too far in the past to message' }, { status: 400 });
    }

    const { data: coachAthlete } = await admin
      .from('athletes')
      .select('first_name, last_name')
      .eq('id', session.athlete_id ?? user.id)
      .maybeSingle();
    const coachName = coachAthlete
      ? [coachAthlete.first_name, coachAthlete.last_name].filter(Boolean).join(' ') || 'Coach'
      : 'Coach';

    const product = tenant.productName || 'The Guild';
    const prefix = `${product} — ${coachName}: `;

    const result = await sendSessionSms(admin, sessionId, message, prefix, target);

    if (result.sent === 0 && result.skippedNoPhone > 0 && result.failed.length === 0) {
      let hint =
        'No phone numbers on file for the selected recipients.';
      if (target.startsWith('parent:')) {
        hint = 'That parent has no cell on their account or on the athlete profile.';
      } else if (target.startsWith('athlete:')) {
        hint = 'That athlete has no cell on their wrestler profile (Wrestlers → Edit).';
      } else if (target === 'broadcast:athletes') {
        hint =
          'No athlete cell numbers on file. Parents can add a mobile number on each wrestler profile (Wrestlers → Edit).';
      } else if (target === 'broadcast:both') {
        hint = 'No phone numbers found. Parents or athletes need cell numbers on file.';
      } else if (target === 'broadcast:parents') {
        hint = 'No parent phone numbers on file. Parents need a cell on their account or athlete profile.';
      }
      return NextResponse.json({ error: hint, target, ...result }, { status: 400 });
    }

    return NextResponse.json({ target, ...result });
  } catch (e) {
    console.error('sms-group POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
