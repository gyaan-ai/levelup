import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/**
 * Record a coach payout for specific session(s) with a custom amount.
 * Use when parents did not pay but you are still paying the coach (e.g. $50 flat).
 * Sets athlete_payment = amount and athlete_payout_date = today for the given sessions.
 */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const amount = typeof body?.amount === 'number' ? body.amount : parseFloat(body?.amount);
    if (Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: 'Valid amount (number >= 0) required' }, { status: 400 });
    }

    const sessionIds = body?.sessionIds ?? body?.session_ids;
    const athleteId = body?.athleteId ?? body?.athlete_id;
    const admin = createAdminClient(tenant.slug);
    const today = new Date().toISOString().slice(0, 10);

    let ids: string[] = [];
    if (Array.isArray(sessionIds) && sessionIds.length > 0) {
      ids = sessionIds.filter((id): id is string => typeof id === 'string');
    } else if (typeof athleteId === 'string') {
      const { data: rows, error: fetchError } = await admin
        .from('sessions')
        .select('id')
        .eq('athlete_id', athleteId)
        .eq('status', 'completed')
        .is('athlete_payout_date', null);
      if (fetchError) {
        console.error('Record payout fetch sessions error:', fetchError);
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }
      ids = (rows ?? []).map((r) => r.id);
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No sessions to update. Provide sessionIds or athleteId with unpaid completed sessions.' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await admin
      .from('sessions')
      .update({ athlete_payment: amount, athlete_payout_date: today })
      .in('id', ids)
      .select('id');

    if (updateError) {
      console.error('Record payout error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const updatedCount = updated?.length ?? 0;
    return NextResponse.json({ success: true, updatedCount });
  } catch (e) {
    console.error('Record payout error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
