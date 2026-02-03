import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// PATCH /api/workspaces/[id]/messages/[messageId] - Edit message
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id: workspaceId, messageId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient(tenant.slug);

    // Verify message exists and user owns it
    const { data: msg } = await admin
      .from('workspace_messages')
      .select('id, author_id, workspace_id')
      .eq('id', messageId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    if (msg.author_id !== user.id) return NextResponse.json({ error: 'Can only edit your own messages' }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { content?: string };
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 });

    const { data: updated, error } = await admin
      .from('workspace_messages')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', messageId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: updated });
  } catch (e) {
    console.error('Message PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id]/messages/[messageId] - Delete message
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id: workspaceId, messageId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient(tenant.slug);

    // Verify message exists and user owns it
    const { data: msg } = await admin
      .from('workspace_messages')
      .select('id, author_id, workspace_id')
      .eq('id', messageId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    if (msg.author_id !== user.id) return NextResponse.json({ error: 'Can only delete your own messages' }, { status: 403 });

    const { error } = await admin
      .from('workspace_messages')
      .delete()
      .eq('id', messageId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Message DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
