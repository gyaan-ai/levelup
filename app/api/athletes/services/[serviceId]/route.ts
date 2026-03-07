import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

const PLATFORM_PERCENT = 0.10;

/** PATCH - update a service */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if ([30, 60, 90, 120].includes(Number(body.durationMinutes))) {
      updates.duration_minutes = Number(body.durationMinutes);
    }
    if (['private', 'partner', 'small_group'].includes(body.sessionType)) {
      updates.session_type = body.sessionType;
      if (body.sessionType === 'private') updates.max_participants = 1;
      else if (body.sessionType === 'partner') updates.max_participants = 2;
      else if (body.maxParticipants != null) {
        updates.max_participants = Math.min(20, Math.max(3, Number(body.maxParticipants)));
      }
    } else if (body.maxParticipants != null && body.sessionType === 'small_group') {
      updates.max_participants = Math.min(20, Math.max(3, Number(body.maxParticipants)));
    }
    if (typeof body.parentPrice === 'number' || (typeof body.parentPrice === 'string' && body.parentPrice !== '')) {
      const parentPrice = Math.max(0, Number(body.parentPrice));
      updates.parent_price = parentPrice;
      updates.athlete_payout = Math.round(parentPrice * (1 - PLATFORM_PERCENT) * 100) / 100;
    }
    if (typeof body.active === 'boolean') updates.active = body.active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from('athlete_services')
      .update(updates)
      .eq('id', serviceId)
      .eq('athlete_id', user.id)
      .select('id, duration_minutes, session_type, max_participants, parent_price, athlete_payout, display_order, active')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

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
      },
    });
  } catch (e) {
    console.error('Athletes services PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE - remove a service */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('athlete_services')
      .delete()
      .eq('id', serviceId)
      .eq('athlete_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Athletes services DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
