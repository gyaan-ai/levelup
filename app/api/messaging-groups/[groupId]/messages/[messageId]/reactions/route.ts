import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** POST - add reaction. Body: { emoji } */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string; messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const emoji = typeof body.emoji === 'string' ? body.emoji.trim().slice(0, 20) : '';
    if (!emoji) return NextResponse.json({ error: 'emoji is required' }, { status: 400 });

    await supabase.from('messaging_message_reactions').upsert(
      { message_id: messageId, user_id: user.id, emoji },
      { onConflict: 'message_id,user_id,emoji' }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Messaging reaction POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE - remove reaction. Query: ?emoji=:emoji */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ groupId: string; messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const { searchParams } = new URL(req.url);
    const emoji = searchParams.get('emoji') ?? '';

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await supabase
      .from('messaging_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Messaging reaction DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
