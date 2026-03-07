import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json()) as { sessionId: string; youthWrestlerId: string; message?: string };
    const { sessionId, youthWrestlerId, message } = body;
    if (!sessionId || !youthWrestlerId) {
      return NextResponse.json({ error: 'Missing sessionId or youthWrestlerId' }, { status: 400 });
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, parent_id, athlete_id, session_mode, session_type, current_participants, max_participants')
      .eq('id', sessionId)
      .single();
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    const s = session as { parent_id?: string; athlete_id?: string; session_mode?: string; session_type?: string; current_participants?: number; max_participants?: number };
    const current = s.current_participants ?? 1;
    const max = s.max_participants ?? 2;
    const isPartnerOpen = s.session_mode === 'partner-open';
    const isSmallGroup = (s.session_type === 'group' || s.session_type === 'small_group') && max > 2;
    const isJoinable = isPartnerOpen || (isSmallGroup && current < max);
    if (!isJoinable) return NextResponse.json({ error: 'Session is not open for join requests' }, { status: 400 });
    if (current >= max) return NextResponse.json({ error: 'Session is full' }, { status: 400 });
    if (s.parent_id === user.id) return NextResponse.json({ error: 'You cannot request to join your own session' }, { status: 403 });

    const { data: yw } = await supabase
      .from('youth_wrestlers')
      .select('id, parent_id')
      .eq('id', youthWrestlerId)
      .single();
    if (!yw || (yw as { parent_id?: string }).parent_id !== user.id) {
      return NextResponse.json({ error: 'Youth wrestler not found or not yours' }, { status: 400 });
    }

    const { error } = await supabase.from('session_join_requests').insert({
      session_id: sessionId,
      requesting_parent_id: user.id,
      youth_wrestler_id: youthWrestlerId,
      message: message ?? null,
      status: 'pending',
    });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'You already requested to join this session' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: ywNameRow } = await supabase
      .from('youth_wrestlers')
      .select('first_name, last_name')
      .eq('id', youthWrestlerId)
      .single();
    const ywName = ywNameRow ? [ywNameRow.first_name, ywNameRow.last_name].filter(Boolean).join(' ') : 'A wrestler';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    const link = `${baseUrl}/sessions/${sessionId}/requests`;
    const title = 'Join request for your session';
    const body = `${ywName} requested to join. Approve or decline based on skill level, weight, etc.`;

    try {
      const admin = createAdminClient(tenant.slug);
      // Notify parent who established the session (small group / partner host)
      if (s.parent_id) {
        await createNotification(admin, {
          user_id: s.parent_id,
          type: 'session_join_request',
          title,
          body,
          data: { sessionId, youthWrestlerId, link },
        });
      }
      // Notify coach (athlete) so they see the request too
      if (s.athlete_id && s.athlete_id !== s.parent_id) {
        await createNotification(admin, {
          user_id: s.athlete_id,
          type: 'session_join_request',
          title,
          body,
          data: { sessionId, youthWrestlerId, link },
        });
      }
    } catch (notifErr) {
      console.warn('Join request notification failed:', notifErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Session join request error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
