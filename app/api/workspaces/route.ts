import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// GET /api/workspaces - List workspaces for current user (as parent or coach)
export async function GET(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();

    const admin = createAdminClient(tenant.slug);

    if (userData?.role !== 'parent' && userData?.role !== 'athlete' && userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (userData?.role === 'parent') {
      const { data: sessions } = await admin
        .from('sessions')
        .select('id, parent_id, athlete_id')
        .eq('parent_id', user.id)
        .in('status', ['scheduled', 'completed']);
      if (sessions?.length) {
        const { data: participants } = await admin
          .from('session_participants')
          .select('session_id, youth_wrestler_id')
          .in('session_id', sessions.map((s) => s.id));
        const seen = new Set<string>();
        for (const p of participants || []) {
          const sess = sessions.find((s) => s.id === p.session_id);
          if (!sess) continue;
          const key = `${sess.parent_id}-${p.youth_wrestler_id}-${sess.athlete_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            await admin.rpc('get_or_create_workspace', {
              p_parent_id: sess.parent_id,
              p_youth_wrestler_id: p.youth_wrestler_id,
              p_athlete_id: sess.athlete_id,
            });
          }
        }
      }
    } else if (userData?.role === 'athlete') {
      const { data: sessions } = await admin
        .from('sessions')
        .select('id, parent_id, athlete_id')
        .eq('athlete_id', user.id)
        .in('status', ['scheduled', 'completed']);
      if (sessions?.length) {
        const { data: participants } = await admin
          .from('session_participants')
          .select('session_id, youth_wrestler_id')
          .in('session_id', sessions.map((s) => s.id));
        const seen = new Set<string>();
        for (const p of participants || []) {
          const sess = sessions.find((s) => s.id === p.session_id);
          if (!sess) continue;
          const key = `${sess.parent_id}-${p.youth_wrestler_id}-${sess.athlete_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            await admin.rpc('get_or_create_workspace', {
              p_parent_id: sess.parent_id,
              p_youth_wrestler_id: p.youth_wrestler_id,
              p_athlete_id: sess.athlete_id,
            });
          }
        }
      }
    }

    let query = admin
      .from('workspaces')
      .select(`
        id,
        parent_id,
        youth_wrestler_id,
        athlete_id,
        created_at,
        updated_at,
        youth_wrestlers(id, first_name, last_name),
        athletes(id, first_name, last_name, school, photo_url)
      `);

    if (userData?.role === 'parent') {
      query = query.eq('parent_id', user.id);
    } else if (userData?.role === 'athlete') {
      query = query.eq('athlete_id', user.id);
    }

    const { data: workspaces, error } = await query.order('updated_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ workspaces: workspaces || [] });
  } catch (e) {
    console.error('Workspaces GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workspaces - Get or create workspace
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { parentId, youthWrestlerId, athleteId } = body;
    if (!parentId || !youthWrestlerId || !athleteId) {
      return NextResponse.json({ error: 'Missing parentId, youthWrestlerId, or athleteId' }, { status: 400 });
    }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();

    if (userData?.role === 'parent' && parentId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (userData?.role === 'athlete' && athleteId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: workspace, error } = await admin.rpc('get_or_create_workspace', {
      p_parent_id: parentId,
      p_youth_wrestler_id: youthWrestlerId,
      p_athlete_id: athleteId,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: full } = await admin
      .from('workspaces')
      .select(`
        id,
        parent_id,
        youth_wrestler_id,
        athlete_id,
        created_at,
        youth_wrestlers(id, first_name, last_name),
        athletes(id, first_name, last_name, school, photo_url)
      `)
      .eq('id', workspace)
      .single();

    return NextResponse.json({ workspace: full });
  } catch (e) {
    console.error('Workspaces POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
