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

    const [goalsRes, mediaRes, notesRes] = await Promise.all([
      admin.from('workspace_goals').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      admin.from('workspace_media').select('*').eq('workspace_id', id).order('created_at', { ascending: false }),
      admin.from('workspace_session_notes').select('*, sessions(scheduled_datetime)').eq('workspace_id', id).order('created_at', { ascending: false }),
    ]);

    // Fetch messages separately - table may not exist if migration not run yet
    let messagesRes: { data: Array<{ id: string; author_id: string; content: string; created_at: string; updated_at?: string }> | null } = { data: [] };
    let reactionsRes: { data: Array<{ message_id: string; user_id: string; emoji: string }> | null } = { data: [] };
    try {
      const res = await admin.from('workspace_messages').select('*').eq('workspace_id', id).order('created_at', { ascending: true });
      messagesRes = res.error ? { data: [] } : res;
      // Fetch reactions for all messages in this workspace
      const msgIds = (res.data || []).map((m: { id: string }) => m.id);
      if (msgIds.length > 0) {
        const rRes = await admin.from('workspace_message_reactions').select('*').in('message_id', msgIds);
        reactionsRes = rRes.error ? { data: [] } : rRes;
      }
    } catch {
      messagesRes = { data: [] };
    }

    const media = (mediaRes.data || []) as Array<{ id: string; storage_path: string; [k: string]: unknown }>;
    const mediaWithUrls = await Promise.all(
      media.map(async (m) => {
        const { data } = await admin.storage.from('workspace-media').createSignedUrl(m.storage_path, 60 * 60 * 24);
        return { ...m, viewUrl: data?.signedUrl || null };
      })
    );

    // Resolve author info for messages: name and photo
    const messages = (messagesRes.data || []) as Array<{ id: string; author_id: string; content: string; created_at: string; updated_at?: string }>;
    const authorIds = [...new Set(messages.map((m) => m.author_id))];
    const authorMap = new Map<string, { name: string; photo?: string }>();

    if (authorIds.length > 0) {
      const { data: athleteRows } = await admin.from('athletes').select('id, first_name, last_name, photo_url').in('id', authorIds);
      for (const a of athleteRows || []) {
        const ar = a as { id: string; first_name?: string; last_name?: string; photo_url?: string };
        const name = `${ar.first_name || ''} ${ar.last_name || ''}`.trim();
        if (name) authorMap.set(ar.id, { name, photo: ar.photo_url || undefined });
      }
      const { data: ywRows } = await admin.from('youth_wrestlers').select('id, first_name, last_name, photo_url').in('id', authorIds);
      for (const y of ywRows || []) {
        const yr = y as { id: string; first_name?: string; last_name?: string; photo_url?: string };
        const name = `${yr.first_name || ''} ${yr.last_name || ''}`.trim();
        if (name && !authorMap.has(yr.id)) authorMap.set(yr.id, { name, photo: yr.photo_url || undefined });
      }
      const { data: userRows } = await admin.from('users').select('id, email').in('id', authorIds);
      for (const u of userRows || []) {
        const ur = u as { id: string; email?: string };
        if (!authorMap.has(ur.id)) authorMap.set(ur.id, { name: ur.email?.split('@')[0] || 'User', photo: undefined });
      }
    }

    // Group reactions by message
    const reactionsByMsg = new Map<string, Array<{ emoji: string; userIds: string[] }>>();
    for (const r of reactionsRes.data || []) {
      const rr = r as { message_id: string; user_id: string; emoji: string };
      if (!reactionsByMsg.has(rr.message_id)) reactionsByMsg.set(rr.message_id, []);
      const msgReactions = reactionsByMsg.get(rr.message_id)!;
      const existing = msgReactions.find((x) => x.emoji === rr.emoji);
      if (existing) existing.userIds.push(rr.user_id);
      else msgReactions.push({ emoji: rr.emoji, userIds: [rr.user_id] });
    }

    const messagesWithAuthors = messages.map((m) => {
      const author = authorMap.get(m.author_id);
      return {
        ...m,
        authorName: author?.name || 'User',
        authorPhoto: author?.photo || null,
        reactions: reactionsByMsg.get(m.id) || [],
        isEdited: m.updated_at && m.updated_at !== m.created_at,
      };
    });

    const { data: sessionsData } = await admin
      .from('sessions')
      .select(`
        id,
        scheduled_datetime,
        duration_minutes,
        status,
        athlete_id,
        parent_id,
        youth_wrestler_id,
        session_participants!inner(
          id,
          session_id,
          parent_id,
          youth_wrestler_id
        )
      `)
      .eq('athlete_id', workspace.athlete_id)
      .eq('session_participants.parent_id', workspace.parent_id)
      .order('scheduled_datetime', { ascending: false });

    const sessionIds = (sessionsData || []).map((s) => s.id);
    const { data: summariesData } = sessionIds.length
      ? await admin.from('session_summaries').select('*').in('session_id', sessionIds)
      : { data: [] as Array<Record<string, unknown>> };

    const sessionsWithSummaries = (sessionsData || []).map((session) => ({
      id: session.id,
      scheduled_datetime: session.scheduled_datetime,
      duration_minutes: session.duration_minutes,
      status: session.status,
      summary: (summariesData || []).find((s) => s.session_id === session.id) || null,
    }));
    const { data: actionItems } = await admin
      .from('workspace_actions')
      .select('*')
      .eq('workspace_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      workspace,
      currentUserId: user.id,
      goals: goalsRes.data || [],
      media: mediaWithUrls,
      notes: notesRes.data || [],
      actions: actionItems || [],
      sessions: sessionsWithSummaries,
      messages: messagesWithAuthors,
      currentUserRole: userData?.role || null,
    });
  } catch (e) {
    console.error('Workspace GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
