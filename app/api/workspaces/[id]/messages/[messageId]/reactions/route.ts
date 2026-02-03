import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

// POST /api/workspaces/[id]/messages/[messageId]/reactions - Add reaction
export async function POST(
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

    // Verify workspace access
    const { data: ws } = await admin.from('workspaces').select('parent_id, athlete_id').eq('id', workspaceId).single();
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    const { data: ud } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (ws.parent_id !== user.id && ws.athlete_id !== user.id && ud?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify message exists in workspace
    const { data: msg } = await admin
      .from('workspace_messages')
      .select('id')
      .eq('id', messageId)
      .eq('workspace_id', workspaceId)
      .single();
    if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    const body = await req.json().catch(() => ({})) as { emoji?: string };
    const emoji = typeof body.emoji === 'string' ? body.emoji.trim() : '';
    if (!emoji) return NextResponse.json({ error: 'Emoji required' }, { status: 400 });

    const { data: reaction, error } = await admin
      .from('workspace_message_reactions')
      .upsert({ message_id: messageId, user_id: user.id, emoji }, { onConflict: 'message_id,user_id,emoji' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reaction });
  } catch (e) {
    console.error('Reaction POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id]/messages/[messageId]/reactions - Remove reaction
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

    const { searchParams } = new URL(req.url);
    const emoji = searchParams.get('emoji');
    if (!emoji) return NextResponse.json({ error: 'Emoji required' }, { status: 400 });

    const { error } = await admin
      .from('workspace_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Reaction DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
