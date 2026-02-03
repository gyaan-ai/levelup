import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// PATCH /api/workspaces/[id]/actions/[actionId] - Update status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { id: workspaceId, actionId } = await params;
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
    if (ws.parent_id !== user.id && ws.athlete_id !== user.id && ud?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const status = body.status === 'completed' ? 'completed' : 'pending';

    const { data: action, error } = await admin
      .from('workspace_actions')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', actionId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!action) return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    return NextResponse.json(action);
  } catch (e) {
    console.error('Action PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id]/actions/[actionId] - Remove action
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { id: workspaceId, actionId } = await params;
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
    if (ws.athlete_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await admin
      .from('workspace_actions')
      .delete()
      .eq('id', actionId)
      .eq('workspace_id', workspaceId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Action DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
