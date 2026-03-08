import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { DM_UNAVAILABLE_MESSAGE, isMissingTableError } from '@/lib/coach-inquiries-errors';

/** GET - unread thread count for current user (parent or athlete) */
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: messages, error: messagesError } = await supabase
      .from('coach_inquiries')
      .select('parent_id, athlete_id, sender_id, created_at')
      .or(`parent_id.eq.${user.id},athlete_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (messagesError) {
      if (isMissingTableError(messagesError)) return NextResponse.json({ error: DM_UNAVAILABLE_MESSAGE }, { status: 503 });
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    const { data: readRows, error: readError } = await supabase
      .from('coach_inquiry_thread_read')
      .select('parent_id, athlete_id, last_read_at')
      .eq('user_id', user.id);

    if (readError && isMissingTableError(readError)) {
      return NextResponse.json({ error: DM_UNAVAILABLE_MESSAGE }, { status: 503 });
    }

    const readMap = new Map<string, string>();
    for (const r of readRows ?? []) {
      readMap.set(`${r.parent_id}:${r.athlete_id}`, r.last_read_at);
    }

    const seen = new Set<string>();
    let unread = 0;
    for (const m of messages ?? []) {
      const key = `${m.parent_id}:${m.athlete_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (m.sender_id === user.id) continue;
      const lastRead = readMap.get(key);
      if (!lastRead || new Date(m.created_at) > new Date(lastRead)) unread += 1;
    }

    return NextResponse.json({ count: unread });
  } catch (e) {
    console.error('Coach inquiries unread-count error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
