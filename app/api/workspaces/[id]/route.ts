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

    const [goalsRes, mediaRes, notesRes, actionsRes, messagesRes] = await Promise.all([
      admin.from('workspace_goals').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      admin.from('workspace_media').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      admin.from('workspace_session_notes').select('*, sessions(scheduled_datetime)').eq('workspace_id', id).order('created_at', { ascending: false }),
      admin.from('workspace_actions').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      admin.from('workspace_messages').select('*').eq('workspace_id', id).order('created_at', { ascending: true }),
    ]);

    const media = (mediaRes.data || []) as Array<{ id: string; storage_path: string; [k: string]: unknown }>;
    const mediaWithUrls = await Promise.all(
      media.map(async (m) => {
        const { data } = await admin.storage.from('workspace-media').createSignedUrl(m.storage_path, 60 * 60 * 24);
        return { ...m, viewUrl: data?.signedUrl || null };
      })
    );

    // Resolve author names for messages: coach (athlete), parent, or admin
    const messages = (messagesRes.data || []) as Array<{ id: string; author_id: string; content: string; created_at: string }>;
    const authorIds = [...new Set(messages.map((m) => m.author_id))];
    const authorMap = new Map<string, string>();

    if (authorIds.length > 0) {
      const { data: athleteRows } = await admin.from('athletes').select('id, first_name, last_name').in('id', authorIds);
      for (const a of athleteRows || []) {
        const ar = a as { id: string; first_name?: string; last_name?: string };
        const name = `${ar.first_name || ''} ${ar.last_name || ''}`.trim();
        if (name) authorMap.set(ar.id, name);
      }
      const { data: userRows } = await admin.from('users').select('id, email').in('id', authorIds);
      for (const u of userRows || []) {
        const ur = u as { id: string; email?: string };
        if (!authorMap.has(ur.id)) authorMap.set(ur.id, ur.email || 'Parent');
      }
    }

    const messagesWithAuthors = messages.map((m) => ({
      ...m,
      authorLabel: authorMap.get(m.author_id) || (m.author_id === workspace.parent_id ? 'Parent' : m.author_id === workspace.athlete_id ? 'Coach' : 'User'),
    }));

    return NextResponse.json({
      workspace,
      goals: goalsRes.data || [],
      media: mediaWithUrls,
      notes: notesRes.data || [],
      actions: actionsRes.data || [],
      messages: messagesWithAuthors,
    });
  } catch (e) {
    console.error('Workspace GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
