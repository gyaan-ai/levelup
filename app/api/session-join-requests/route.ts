import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

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
      .select('id, parent_id, session_mode, current_participants, max_participants')
      .eq('id', sessionId)
      .single();
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if ((session as { session_mode?: string }).session_mode !== 'partner-open') {
      return NextResponse.json({ error: 'Session is not open for join requests' }, { status: 400 });
    }
    const current = (session as { current_participants?: number }).current_participants ?? 1;
    const max = (session as { max_participants?: number }).max_participants ?? 2;
    if (current >= max) return NextResponse.json({ error: 'Session is full' }, { status: 400 });
    if ((session as { parent_id?: string }).parent_id === user.id) {
      return NextResponse.json({ error: 'You cannot request to join your own session' }, { status: 400 });
    }

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

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Session join request error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
