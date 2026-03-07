import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** GET - list parents the athlete has sessions or workspaces with (for starting a DM). */
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role !== 'athlete') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const athleteId = user.id;

    // Parent IDs from sessions (parent_id on sessions where athlete_id = me)
    const { data: sessionParents } = await supabase
      .from('sessions')
      .select('parent_id')
      .eq('athlete_id', athleteId);
    const fromSessions = new Set((sessionParents ?? []).map((s: { parent_id: string }) => s.parent_id));

    // Parent IDs from workspaces
    const { data: workspaceParents } = await supabase
      .from('workspaces')
      .select('parent_id')
      .eq('athlete_id', athleteId);
    const fromWorkspaces = new Set((workspaceParents ?? []).map((w: { parent_id: string }) => w.parent_id));

    const parentIds = Array.from(new Set([...fromSessions, ...fromWorkspaces])).filter(Boolean);
    if (parentIds.length === 0) {
      return NextResponse.json({ parents: [] });
    }

    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', parentIds);

    const byId = new Map((users ?? []).map((u: { id: string; email?: string }) => [u.id, u]));

    const parents = parentIds.map((id) => {
      const u = byId.get(id) as { id: string; email?: string } | undefined;
      const email = u?.email ?? '';
      const name = email ? (email.includes('@') ? email.split('@')[0] : email) : `Parent`;
      return { id, name, email: email || undefined };
    });

    return NextResponse.json({ parents });
  } catch (e) {
    console.error('Parents for athlete GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
