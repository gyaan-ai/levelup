import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

async function requireAuth(workspaceId: string) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) {
    return { error: NextResponse.json({ error: 'Tenant not found' }, { status: 404 }) };
  }

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = createAdminClient(tenant.slug);
  const { data: workspace } = await admin.from('workspaces').select('parent_id, athlete_id').eq('id', workspaceId).single();
  if (!workspace) {
    return { error: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }) };
  }

  const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).single();
  const isAuthorized =
    workspace.parent_id === user.id ||
    workspace.athlete_id === user.id ||
    userRow?.role === 'admin';

  if (!isAuthorized) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { tenant, admin, user };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const { id: workspaceId, mediaId } = await params;
    const auth = await requireAuth(workspaceId);
    if ('error' in auth) return auth.error;
    const { admin } = auth;

    const { data: mediaRow, error: fetchError } = await admin
      .from('workspace_media')
      .select('id, storage_path')
      .eq('id', mediaId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !mediaRow) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const { error: removeError } = await admin.storage
      .from('workspace-media')
      .remove([mediaRow.storage_path]);
    if (removeError) {
      console.error('Workspace media delete storage error:', removeError);
      return NextResponse.json({ error: `Failed to remove file: ${removeError.message}` }, { status: 500 });
    }

    const { error: deleteError } = await admin
      .from('workspace_media')
      .delete()
      .eq('id', mediaId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Workspace media DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  try {
    const { id: workspaceId, mediaId } = await params;
    const auth = await requireAuth(workspaceId);
    if ('error' in auth) return auth.error;
    const { admin } = auth;

    const body = await req.json().catch(() => ({}));
    const note = typeof body.description === 'string' ? body.description.trim() : '';

    const { data: mediaRow, error } = await admin
      .from('workspace_media')
      .update({ description: note || null })
      .eq('id', mediaId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ media: mediaRow });
  } catch (e) {
    console.error('Workspace media PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
