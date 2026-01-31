import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// POST /api/workspaces/[id]/notes - Coach adds session summary
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
    const { data: ws } = await admin.from('workspaces').select('parent_id, athlete_id').eq('id', workspaceId).single();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    const { data: ud } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (ws.athlete_id !== user.id && ud?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - only coach can add session notes' }, { status: 403 });
    }

    const body = await req.json();
    const { summary, highlights, focusAreas, sessionId } = body;
    if (!summary || typeof summary !== 'string') {
      return NextResponse.json({ error: 'Summary required' }, { status: 400 });
    }

    const { data: note, error } = await admin
      .from('workspace_session_notes')
      .insert({
        workspace_id: workspaceId,
        session_id: sessionId || null,
        summary: summary.trim(),
        highlights: highlights?.trim() || null,
        focus_areas: focusAreas?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ note });
  } catch (e) {
    console.error('Notes POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
