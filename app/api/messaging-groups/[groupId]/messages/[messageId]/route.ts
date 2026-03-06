import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** PATCH - edit own message. Body: { body } */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string; messageId: string }> }
) {
  try {
    const { groupId, messageId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!text) return NextResponse.json({ error: 'Message body is required' }, { status: 400 });

    const { data: message, error } = await supabase
      .from('messaging_channel_messages')
      .update({ body: text, edited_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('author_id', user.id)
      .select('id, body, edited_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    return NextResponse.json({ message: { id: message.id, body: message.body, editedAt: message.edited_at } });
  } catch (e) {
    console.error('Messaging message PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
