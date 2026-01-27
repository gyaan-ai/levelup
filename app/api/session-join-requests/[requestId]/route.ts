import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as { action: 'approve' | 'decline'; sessionId: string };
    const { action, sessionId } = body;
    if (!action || !sessionId) return NextResponse.json({ error: 'Missing action or sessionId' }, { status: 400 });

    const { data: session } = await supabase
      .from('sessions')
      .select('id, parent_id, current_participants, max_participants')
      .eq('id', sessionId)
      .single();
    if (!session || (session as { parent_id?: string }).parent_id !== user.id) {
      return NextResponse.json({ error: 'Session not found or not yours' }, { status: 404 });
    }

    const { data: joinRequest } = await supabase
      .from('session_join_requests')
      .select('id, session_id, requesting_parent_id, youth_wrestler_id, status')
      .eq('id', requestId)
      .eq('session_id', sessionId)
      .single();
    if (!joinRequest || (joinRequest as { status?: string }).status !== 'pending') {
      return NextResponse.json({ error: 'Request not found or already responded' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'declined';

    if (action === 'approve') {
      const current = (session as { current_participants?: number }).current_participants ?? 1;
      const max = (session as { max_participants?: number }).max_participants ?? 2;
      if (current >= max) return NextResponse.json({ error: 'Session is full' }, { status: 400 });

      const { error: upErr } = await supabase.from('sessions').update({
        current_participants: current + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      const { error: partErr } = await supabase.from('session_participants').insert({
        session_id: sessionId,
        youth_wrestler_id: (joinRequest as { youth_wrestler_id?: string }).youth_wrestler_id,
        parent_id: (joinRequest as { requesting_parent_id?: string }).requesting_parent_id,
        paid: false,
        amount_paid: null,
      });
      if (partErr) {
        await supabase.from('sessions').update({ current_participants: current }).eq('id', sessionId);
        return NextResponse.json({ error: partErr.message }, { status: 500 });
      }
    }

    const { error: reqErr } = await supabase
      .from('session_join_requests')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('id', requestId);
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (e) {
    console.error('Session join request PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
