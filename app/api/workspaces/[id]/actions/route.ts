import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// POST /api/workspaces/[id]/actions - Coach adds action item
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient(tenant.slug);
    const { data: ws } = await admin.from('workspaces').select('athlete_id').eq('id', workspaceId).single();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    const { data: ud } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (ws.athlete_id !== user.id && ud?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - only coach can add actions' }, { status: 403 });
    }

    const body = await req.json();
    const { content, sessionNoteId, dueBeforeSessionId } = body;
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const { data: action, error } = await admin
      .from('workspace_actions')
      .insert({
        workspace_id: workspaceId,
        content: content.trim(),
        session_note_id: sessionNoteId || null,
        due_before_session_id: dueBeforeSessionId || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ action });
  } catch (e) {
    console.error('Actions POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
