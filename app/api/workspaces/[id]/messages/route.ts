import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// POST /api/workspaces/[id]/messages - Add a collaboration message
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
    const isParent = ws.parent_id === user.id;
    const isCoach = ws.athlete_id === user.id;
    const isAdmin = ud?.role === 'admin';

    if (!isParent && !isCoach && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as { content?: string };
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const { data: msg, error } = await admin
      .from('workspace_messages')
      .insert({
        workspace_id: workspaceId,
        author_id: user.id,
        content,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: msg });
  } catch (e) {
    console.error('Workspace messages POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
