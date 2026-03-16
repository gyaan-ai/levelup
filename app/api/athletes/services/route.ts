import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { coachPayoutFromParentPrice } from '@/lib/pricing';

/** GET - list current user's (coach) services */
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: athlete } = await supabase.from('athletes').select('id').eq('id', user.id).single();
    if (!athlete) return NextResponse.json({ error: 'Coach profile not found' }, { status: 403 });

    const { data: rows, error } = await supabase
      .from('athlete_services')
      .select('id, duration_minutes, session_type, max_participants, parent_price, athlete_payout, display_order, active, created_at')
      .eq('athlete_id', athlete.id)
      .order('display_order', { ascending: true })
      .order('duration_minutes', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      services: (rows ?? []).map((r) => ({
        id: r.id,
        durationMinutes: r.duration_minutes,
        sessionType: r.session_type,
        maxParticipants: r.max_participants,
        parentPrice: Number(r.parent_price),
        athletePayout: Number(r.athlete_payout),
        displayOrder: r.display_order,
        active: r.active,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error('Athletes services GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST - create a service. Body: { durationMinutes, sessionType, maxParticipants?, parentPrice } */
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: athlete } = await supabase.from('athletes').select('id').eq('id', user.id).single();
    if (!athlete) return NextResponse.json({ error: 'Coach profile not found' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const durationMinutes = [30, 60, 90, 120].includes(Number(body.durationMinutes))
      ? Number(body.durationMinutes)
      : 60;
    const sessionType = ['private', 'partner', 'small_group'].includes(body.sessionType)
      ? body.sessionType
      : 'private';
    let maxParticipants = 1;
    if (sessionType === 'partner') maxParticipants = 2;
    else if (sessionType === 'small_group') {
      const n = Math.min(20, Math.max(3, Number(body.maxParticipants) || 6));
      maxParticipants = n;
    }
    const parentPrice = Math.max(0, Number(body.parentPrice) || 0);
    const athletePayout = coachPayoutFromParentPrice(parentPrice);

    const { data: existing } = await supabase
      .from('athlete_services')
      .select('display_order')
      .eq('athlete_id', athlete.id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();
    const displayOrder = (existing?.display_order ?? -1) + 1;

    const { data: row, error } = await supabase
      .from('athlete_services')
      .insert({
        athlete_id: athlete.id,
        duration_minutes: durationMinutes,
        session_type: sessionType,
        max_participants: maxParticipants,
        parent_price: parentPrice,
        athlete_payout: athletePayout,
        display_order: displayOrder,
      })
      .select('id, duration_minutes, session_type, max_participants, parent_price, athlete_payout, display_order, active, created_at')
      .single();

    if (error) {
      console.error('Athletes services POST Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      service: {
        id: row.id,
        durationMinutes: row.duration_minutes,
        sessionType: row.session_type,
        maxParticipants: row.max_participants,
        parentPrice: Number(row.parent_price),
        athletePayout: Number(row.athlete_payout),
        displayOrder: row.display_order,
        active: row.active,
        createdAt: row.created_at,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Athletes services POST error:', e);
    return NextResponse.json({ error: message || 'Internal server error' }, { status: 500 });
  }
}
