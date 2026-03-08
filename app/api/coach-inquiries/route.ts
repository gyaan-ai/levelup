import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { createNotification } from '@/lib/notifications';
import { DM_UNAVAILABLE_MESSAGE, isMissingTableError } from '@/lib/coach-inquiries-errors';

/** GET ?parentId=&athleteId= - messages in thread + other party name */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get('parentId');
    const athleteId = searchParams.get('athleteId');
    if (!parentId || !athleteId) {
      return NextResponse.json({ error: 'Missing parentId or athleteId' }, { status: 400 });
    }

    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.id !== parentId && user.id !== athleteId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: rows, error } = await supabase
      .from('coach_inquiries')
      .select('id, parent_id, athlete_id, sender_id, body, created_at')
      .eq('parent_id', parentId)
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: true });

    if (error) {
      if (isMissingTableError(error)) return NextResponse.json({ error: DM_UNAVAILABLE_MESSAGE }, { status: 503 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const otherId = user.id === parentId ? athleteId : parentId;
    let otherName = '';

    if (user.id === parentId) {
      const { data: athlete } = await supabase
        .from('athletes')
        .select('first_name, last_name')
        .eq('id', athleteId)
        .single();
      if (athlete) {
        otherName = [athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || 'Coach';
      } else {
        otherName = 'Coach';
      }
    } else {
      const { data: parentUser } = await supabase
        .from('users')
        .select('email')
        .eq('id', parentId)
        .single();
      otherName = parentUser?.email ? `Parent (${parentUser.email})` : 'Parent';
    }

    return NextResponse.json({
      messages: rows ?? [],
      otherParty: { id: otherId, name: otherName },
    });
  } catch (e) {
    console.error('Coach inquiries GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST { parentId, athleteId, body } - send message */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as { parentId: string; athleteId: string; body: string };
    const { parentId, athleteId, body: text } = body;
    if (!parentId || !athleteId || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Missing parentId, athleteId, or body' }, { status: 400 });
    }

    if (user.id !== parentId && user.id !== athleteId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: row, error } = await supabase
      .from('coach_inquiries')
      .insert({
        parent_id: parentId,
        athlete_id: athleteId,
        sender_id: user.id,
        body: text.trim(),
      })
      .select('id, parent_id, athlete_id, sender_id, body, created_at')
      .single();

    if (error) {
      if (isMissingTableError(error)) return NextResponse.json({ error: DM_UNAVAILABLE_MESSAGE }, { status: 503 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const recipientId = user.id === parentId ? athleteId : parentId;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
    const threadLink = `${baseUrl}/inbox/thread/${parentId}/${athleteId}`;

    try {
      const admin = createAdminClient(tenant.slug);
      if (recipientId === athleteId) {
        await createNotification(admin, {
          user_id: athleteId,
          type: 'coach_inquiry_message',
          title: 'New message from a parent',
          body: text.trim().slice(0, 100) + (text.trim().length > 100 ? '…' : ''),
          data: { parentId, athleteId, messageId: row.id, link: threadLink },
        });
      } else {
        const { data: coach } = await supabase
          .from('athletes')
          .select('first_name, last_name')
          .eq('id', athleteId)
          .single();
        const coachName = coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ') || 'Coach' : 'Coach';
        await createNotification(admin, {
          user_id: parentId,
          type: 'coach_inquiry_message',
          title: `New message from ${coachName}`,
          body: text.trim().slice(0, 100) + (text.trim().length > 100 ? '…' : ''),
          data: { parentId, athleteId, messageId: row.id, link: threadLink },
        });
      }
    } catch (notifErr) {
      console.warn('Coach inquiry notification insert failed:', notifErr);
    }

    return NextResponse.json({ message: row });
  } catch (e) {
    console.error('Coach inquiries POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
