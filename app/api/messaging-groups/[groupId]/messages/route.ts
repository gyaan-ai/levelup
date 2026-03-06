import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

/** GET - list messages for this group's channel (one channel per group) */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: channel } = await supabase
      .from('messaging_channels')
      .select('id')
      .eq('group_id', groupId)
      .limit(1)
      .single();
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

    const { data: messages, error } = await supabase
      .from('messaging_channel_messages')
      .select('id, channel_id, author_id, body, created_at, edited_at, attachment_url')
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const authorIds = [...new Set((messages ?? []).map((m) => m.author_id))];
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, first_name, last_name, photo_url')
      .in('id', authorIds);
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', authorIds);

    const athleteMap = new Map((athletes ?? []).map((a) => [a.id, a]));
    const userMap = new Map((users ?? []).map((u) => [u.id, u]));

    const { data: reactions } = await supabase
      .from('messaging_message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', (messages ?? []).map((m) => m.id));

    const reactionsByMessage = new Map<string, Array<{ userId: string; emoji: string }>>();
    for (const r of reactions ?? []) {
      if (!reactionsByMessage.has(r.message_id)) reactionsByMessage.set(r.message_id, []);
      reactionsByMessage.get(r.message_id)!.push({ userId: r.user_id, emoji: r.emoji });
    }

    const list = (messages ?? []).map((m) => {
      const a = athleteMap.get(m.author_id);
      const u = userMap.get(m.author_id);
      const authorName = a
        ? [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Coach'
        : (u?.email ?? 'User');
      return {
        id: m.id,
        channelId: m.channel_id,
        authorId: m.author_id,
        authorName,
        body: m.body,
        createdAt: m.created_at,
        editedAt: m.edited_at ?? null,
        attachmentUrl: m.attachment_url ?? null,
        reactions: reactionsByMessage.get(m.id) ?? [],
      };
    });

    return NextResponse.json({ messages: list });
  } catch (e) {
    console.error('Messaging group messages GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST - send a message to the group's channel */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
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

    const { data: channel } = await supabase
      .from('messaging_channels')
      .select('id')
      .eq('group_id', groupId)
      .limit(1)
      .single();
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

    const { data: message, error } = await supabase
      .from('messaging_channel_messages')
      .insert({
        channel_id: channel.id,
        author_id: user.id,
        body: text,
        attachment_url: body.attachmentUrl ?? null,
      })
      .select('id, channel_id, author_id, body, created_at, edited_at, attachment_url')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      message: {
        id: message.id,
        channelId: message.channel_id,
        authorId: message.author_id,
        body: message.body,
        createdAt: message.created_at,
        editedAt: message.edited_at,
        attachmentUrl: message.attachment_url,
        reactions: [],
      },
    });
  } catch (e) {
    console.error('Messaging group messages POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
