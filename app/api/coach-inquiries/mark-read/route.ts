import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** POST { parentId, athleteId } - mark thread as read for current user */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as { parentId: string; athleteId: string };
    const { parentId, athleteId } = body;
    if (!parentId || !athleteId) {
      return NextResponse.json({ error: 'Missing parentId or athleteId' }, { status: 400 });
    }

    if (user.id !== parentId && user.id !== athleteId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('coach_inquiry_thread_read')
      .upsert(
        { user_id: user.id, parent_id: parentId, athlete_id: athleteId, last_read_at: new Date().toISOString() },
        { onConflict: 'user_id,parent_id,athlete_id' }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Coach inquiries mark-read error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
