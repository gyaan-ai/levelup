import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// GET /api/workspaces/[id] - Get workspace with goals, media, notes, actions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient(tenant.slug);

    const { data: workspace, error: wsError } = await admin
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
      .eq('id', id)
      .single();

    if (wsError || !workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

    const isParent = workspace.parent_id === user.id;
    const isCoach = workspace.athlete_id === user.id;
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const isAdmin = userData?.role === 'admin';

    if (!isParent && !isCoach && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [goalsRes, mediaRes, notesRes, actionsRes] = await Promise.all([
      admin.from('workspace_goals').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      admin.from('workspace_media').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      admin.from('workspace_session_notes').select('*, sessions(scheduled_datetime)').eq('workspace_id', id).order('created_at', { ascending: false }),
      admin.from('workspace_actions').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
    ]);

    const media = (mediaRes.data || []) as Array<{ id: string; storage_path: string; [k: string]: unknown }>;
    const mediaWithUrls = await Promise.all(
      media.map(async (m) => {
        const { data } = await admin.storage.from('workspace-media').createSignedUrl(m.storage_path, 60 * 60 * 24);
        return { ...m, viewUrl: data?.signedUrl || null };
      })
    );

    return NextResponse.json({
      workspace,
      goals: goalsRes.data || [],
      media: mediaWithUrls,
      notes: notesRes.data || [],
      actions: actionsRes.data || [],
    });
  } catch (e) {
    console.error('Workspace GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
