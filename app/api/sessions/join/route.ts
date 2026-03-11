import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/**
 * POST - Join a session by invite code. Adds the current user's youth wrestler as a participant.
 * Body: { code: string, youthWrestlerId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as { code?: string; youthWrestlerId?: string };
    const code = (body.code ?? '').toString().trim().toUpperCase();
    const youthWrestlerId = body.youthWrestlerId;

    if (!code || !youthWrestlerId) {
      return NextResponse.json({ error: 'Missing code or youthWrestlerId' }, { status: 400 });
    }

    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, partner_invite_code, current_participants, max_participants, session_mode')
      .eq('partner_invite_code', code)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 404 });
    }

    const current = (session as { current_participants?: number }).current_participants ?? 0;
    const max = (session as { max_participants?: number }).max_participants ?? 2;
    if (current >= max) {
      return NextResponse.json({ error: 'This session is already full' }, { status: 400 });
    }

    const mode = (session as { session_mode?: string }).session_mode;
    if (mode !== 'partner-invite' && mode !== 'partner-open') {
      return NextResponse.json({ error: 'This session is not open to join by link' }, { status: 400 });
    }

    const { data: yw, error: ywErr } = await supabase
      .from('youth_wrestlers')
      .select('id, parent_id')
      .eq('id', youthWrestlerId)
      .single();

    if (ywErr || !yw) {
      return NextResponse.json({ error: 'Youth wrestler not found' }, { status: 404 });
    }
    if (yw.parent_id !== user.id) {
      return NextResponse.json({ error: 'You can only add your own youth wrestler' }, { status: 403 });
    }

    const admin = createAdminClient(tenant.slug);

    const { error: insertErr } = await admin.from('session_participants').insert({
      session_id: session.id,
      youth_wrestler_id: youthWrestlerId,
      parent_id: user.id,
      paid: false,
      amount_paid: null,
    });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'This wrestler is already in the session' }, { status: 409 });
      }
      console.error('Join session insert error:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { error: updateErr } = await admin
      .from('sessions')
      .update({
        current_participants: current + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateErr) {
      console.error('Join session update count error:', updateErr);
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      message: 'You have joined the session. The coach or organizer will confirm payment/details.',
    });
  } catch (e) {
    console.error('Sessions join POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
