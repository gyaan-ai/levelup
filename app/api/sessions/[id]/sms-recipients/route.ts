import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

function shortEmail(email: string | null | undefined): string {
  if (!email) return 'Parent';
  const local = email.split('@')[0] ?? email;
  return local.length > 24 ? `${local.slice(0, 22)}…` : local;
}

/**
 * GET — coach (or admin): list SMS "Send to" options for this session (broadcast + individuals).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: session, error: sessErr } = await admin
      .from('sessions')
      .select('id, athlete_id, status')
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const athleteId = (session as { athlete_id?: string }).athlete_id;
    if (role !== 'admin' && athleteId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: parts, error: pErr } = await admin
      .from('session_participants')
      .select('parent_id, youth_wrestler_id, youth_wrestlers(first_name, last_name)')
      .eq('session_id', sessionId);

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    const rows = parts ?? [];

    type Opt = { value: string; label: string; group: 'everyone' | 'individual' };
    const options: Opt[] = [
      { value: 'broadcast:parents', label: 'All parents', group: 'everyone' },
      { value: 'broadcast:athletes', label: 'All athletes', group: 'everyone' },
      { value: 'broadcast:both', label: 'Everyone (parents + athletes, deduped)', group: 'everyone' },
    ];

    const parentIds = [...new Set(rows.map((r) => r.parent_id as string).filter(Boolean))];
    const { data: parentUsers } =
      parentIds.length > 0
        ? await admin.from('users').select('id, email').in('id', parentIds)
        : { data: [] };

    const parentKidNames = new Map<string, Set<string>>();
    for (const r of rows) {
      const pid = r.parent_id as string | undefined;
      if (!pid) continue;
      const yw = r.youth_wrestlers as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null | undefined;
      const o = Array.isArray(yw) ? yw[0] : yw;
      const kid = o ? [o.first_name, o.last_name].filter(Boolean).join(' ').trim() : '';
      if (!parentKidNames.has(pid)) parentKidNames.set(pid, new Set());
      if (kid) parentKidNames.get(pid)!.add(kid);
    }

    for (const pid of parentIds) {
      const u = parentUsers?.find((x) => x.id === pid);
      const kids = [...(parentKidNames.get(pid) ?? [])].join(', ') || 'athlete';
      const label = `Parent: ${shortEmail(u?.email)} (${kids})`;
      options.push({ value: `parent:${pid}`, label, group: 'individual' });
    }

    const seenYw = new Set<string>();
    for (const r of rows) {
      const ywid = (r as { youth_wrestler_id?: string | null }).youth_wrestler_id;
      if (!ywid || seenYw.has(ywid)) continue;
      seenYw.add(ywid);
      const yw = r.youth_wrestlers as { first_name?: string; last_name?: string } | null;
      const o = Array.isArray(yw) ? yw[0] : yw;
      const name = o ? [o.first_name, o.last_name].filter(Boolean).join(' ').trim() : 'Athlete';
      options.push({ value: `athlete:${ywid}`, label: `Athlete: ${name}`, group: 'individual' });
    }

    options.sort((a, b) => {
      if (a.group !== b.group) return a.group === 'everyone' ? -1 : 1;
      return a.label.localeCompare(b.label);
    });

    return NextResponse.json({ options });
  } catch (e) {
    console.error('sms-recipients GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
