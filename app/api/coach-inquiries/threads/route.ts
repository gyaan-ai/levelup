import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** GET - list threads for current user (parent or athlete) with last message and other party name */
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: messages, error } = await supabase
      .from('coach_inquiries')
      .select('id, parent_id, athlete_id, sender_id, body, created_at')
      .or(`parent_id.eq.${user.id},athlete_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: readRows } = await supabase
      .from('coach_inquiry_thread_read')
      .select('parent_id, athlete_id, last_read_at')
      .eq('user_id', user.id);

    const readMap = new Map<string, string>();
    for (const r of readRows ?? []) {
      readMap.set(`${r.parent_id}:${r.athlete_id}`, r.last_read_at);
    }

    const seen = new Set<string>();
    const threads: Array<{
      parentId: string;
      athleteId: string;
      lastBody: string;
      lastAt: string;
      otherName: string;
      unread: boolean;
    }> = [];

    for (const m of messages ?? []) {
      const key = `${m.parent_id}:${m.athlete_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const lastRead = readMap.get(key);
      const unread = m.sender_id !== user.id && (!lastRead || new Date(m.created_at) > new Date(lastRead));

      let otherName = '';

      if (user.id === m.parent_id) {
        const { data: athlete } = await supabase
          .from('athletes')
          .select('first_name, last_name')
          .eq('id', m.athlete_id)
          .single();
        otherName = athlete ? [athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || 'Coach' : 'Coach';
      } else {
        const { data: parentUser } = await supabase
          .from('users')
          .select('email')
          .eq('id', m.parent_id)
          .single();
        otherName = parentUser?.email ? `Parent (${parentUser.email})` : 'Parent';
      }

      threads.push({
        parentId: m.parent_id,
        athleteId: m.athlete_id,
        lastBody: m.body,
        lastAt: m.created_at,
        otherName,
        unread,
      });
    }

    return NextResponse.json({ threads });
  } catch (e) {
    console.error('Coach inquiries threads GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
