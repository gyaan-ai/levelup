import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: session } = await supabase
      .from('sessions')
      .select('id, parent_id, athlete_id')
      .eq('id', sessionId)
      .single();

    if (!session || (session.parent_id !== user.id && session.athlete_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: rows, error } = await supabase
      .from('booking_messages')
      .select('id, session_id, sender_id, body, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ messages: rows ?? [] });
  } catch (e) {
    console.error('Booking messages GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as { sessionId: string; body: string };
    const { sessionId, body: text } = body;
    if (!sessionId || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Missing sessionId or body' }, { status: 400 });
    }

    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .select('id, parent_id, athlete_id')
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.parent_id !== user.id && session.athlete_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: row, error } = await supabase
      .from('booking_messages')
      .insert({ session_id: sessionId, sender_id: user.id, body: text.trim() })
      .select('id, session_id, sender_id, body, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const recipientId = session.parent_id === user.id ? session.athlete_id : session.parent_id;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);

    try {
      const admin = createAdminClient(tenant.slug);
      await admin.from('notifications').insert({
        user_id: recipientId,
        type: 'booking_message',
        title: 'New message about your session',
        body: text.trim().slice(0, 100) + (text.length > 100 ? '…' : ''),
        data: { sessionId, senderId: user.id, messageId: row.id, link: `${baseUrl}/messages/${sessionId}` },
      });
    } catch (notifErr) {
      console.warn('Notification insert failed:', notifErr);
    }

    return NextResponse.json({ message: row });
  } catch (e) {
    console.error('Booking messages POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
