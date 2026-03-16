import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** GET - list groups for current user (as coach: groups they own; as parent: groups they're in) */
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: groups, error } = await supabase
      .from('messaging_groups')
      .select('id, name, athlete_id, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = (groups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      athleteId: g.athlete_id,
      createdAt: g.created_at,
    }));

    return NextResponse.json({ groups: list });
  } catch (e) {
    console.error('Messaging groups GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST - create a group (coach or parent). Body: { name } */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const role = userData?.role;
    if (role !== 'coach' && role !== 'parent' && role !== 'admin') {
      return NextResponse.json({ error: 'Only coaches or parents can create groups' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Group name is required' }, { status: 400 });

    if (role === 'coach' || role === 'admin') {
      const { data: athlete } = await supabase
        .from('athletes')
        .select('id')
        .eq('id', user.id)
        .single();
      if (!athlete) return NextResponse.json({ error: 'Coach profile not found' }, { status: 403 });

      const { data: group, error } = await supabase
        .from('messaging_groups')
        .insert({ name, athlete_id: athlete.id })
        .select('id, name, athlete_id, created_at')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({
        group: {
          id: group.id,
          name: group.name,
          athleteId: group.athlete_id,
          createdAt: group.created_at,
        },
      });
    }

    // Parent (or admin acting as parent): create parent-owned group
    const { data: group, error } = await supabase
      .from('messaging_groups')
      .insert({ name, parent_id: user.id, athlete_id: null })
      .select('id, name, athlete_id, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        athleteId: group.athlete_id,
        createdAt: group.created_at,
      },
    });
  } catch (e) {
    console.error('Messaging groups POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
