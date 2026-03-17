import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

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
    const athleteId = body?.athleteId ?? body?.athlete_id;
    if (!athleteId || typeof athleteId !== 'string') {
      return NextResponse.json({ error: 'Missing athleteId' }, { status: 400 });
    }
    const totalAmount = body?.amount != null ? Number(body.amount) : null;

    const today = new Date().toISOString().slice(0, 10);
    const admin = createAdminClient(tenant.slug);

    const { data: sessionsToUpdate, error: fetchErr } = await admin
      .from('sessions')
      .select('id, athlete_payment')
      .eq('athlete_id', athleteId)
      .eq('status', 'completed')
      .is('athlete_payout_date', null);

    if (fetchErr || !sessionsToUpdate?.length) {
      return NextResponse.json({ success: true, updatedCount: 0 });
    }

    const count = sessionsToUpdate.length;
    const amountPerSession =
      totalAmount != null && !Number.isNaN(totalAmount) && totalAmount >= 0 && count > 0
        ? Math.round((totalAmount / count) * 100) / 100
        : null;

    for (const s of sessionsToUpdate) {
      const updates: { athlete_payout_date: string; athlete_payment?: number } = {
        athlete_payout_date: today,
      };
      if (amountPerSession != null) {
        updates.athlete_payment = amountPerSession;
      }
      const { error: updateError } = await admin
        .from('sessions')
        .update(updates)
        .eq('id', s.id);
      if (updateError) {
        console.error('Mark payout paid error', s.id, updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, updatedCount: count });
  } catch (e) {
    console.error('Mark payout paid error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
