import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/**
 * POST - Parent (or their kid) leaves a session they joined (e.g. small group).
 * Removes their participant row(s) and decrements current_participants so the spot opens back up.
 * Only for participants; session owner must use the full "cancel session" flow.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'parent' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Only parents can leave a session' }, { status: 403 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: session, error: sessionErr } = await admin
      .from('sessions')
      .select('id, parent_id, current_participants, max_participants, status, scheduled_datetime')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const s = session as { parent_id?: string; current_participants?: number; status?: string };
    if (s.parent_id === user.id) {
      return NextResponse.json(
        { error: "You're the session owner. Use Cancel session to cancel the whole session, or Reschedule to change it." },
        { status: 400 }
      );
    }

    if (s.status !== 'scheduled') {
      return NextResponse.json({ error: 'Session can no longer be left' }, { status: 400 });
    }

    const { data: myRows } = await admin
      .from('session_participants')
      .select('id, youth_wrestler_id')
      .eq('session_id', sessionId)
      .eq('parent_id', user.id);

    if (!myRows?.length) {
      return NextResponse.json({ error: 'You have no spot in this session' }, { status: 400 });
    }

    const count = myRows.length;
    const { error: deleteErr } = await admin
      .from('session_participants')
      .delete()
      .eq('session_id', sessionId)
      .eq('parent_id', user.id);

    if (deleteErr) {
      console.error('Leave session delete error:', deleteErr);
      return NextResponse.json({ error: 'Failed to leave session' }, { status: 500 });
    }

    const current = (s.current_participants ?? 1) - count;
    const { error: updateErr } = await admin
      .from('sessions')
      .update({
        current_participants: Math.max(0, current),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateErr) {
      console.error('Leave session update current_participants error:', updateErr);
      // Participant already removed; log and still return success
    }

    return NextResponse.json({
      success: true,
      message: count === 1 ? "You've left the session. Your spot is open again." : `You've left the session. ${count} spot(s) are open again.`,
    });
  } catch (e) {
    console.error('Leave session error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
