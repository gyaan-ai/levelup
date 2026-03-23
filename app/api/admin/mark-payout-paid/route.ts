import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { coachPayoutUsd } from '@/lib/coach-session-payout';

/**
 * Mark all completed, unpaid sessions for a coach as paid.
 * Sets `athlete_payment` from roster/pricing when missing (same rule as coach dashboard),
 * unless `amount` is provided — then that value is treated as the **total** owed across
 * those sessions and split **proportionally** to each session's estimated share (not 1/n).
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
    const athleteId = body?.athleteId ?? body?.athlete_id;
    if (!athleteId || typeof athleteId !== 'string') {
      return NextResponse.json({ error: 'Missing athleteId' }, { status: 400 });
    }
    const totalAmountRaw = body?.amount;
    const totalAmount =
      totalAmountRaw != null && totalAmountRaw !== ''
        ? Number(totalAmountRaw)
        : null;

    const today = new Date().toISOString().slice(0, 10);
    const admin = createAdminClient(tenant.slug);

    const { data: sessionsToUpdate, error: fetchErr } = await admin
      .from('sessions')
      .select('id, athlete_payment, price_per_participant, current_participants')
      .eq('athlete_id', athleteId)
      .eq('status', 'completed')
      .is('athlete_payout_date', null);

    if (fetchErr || !sessionsToUpdate?.length) {
      return NextResponse.json({ success: true, updatedCount: 0 });
    }

    const rows = sessionsToUpdate as Array<{
      id: string;
      athlete_payment?: number | null;
      price_per_participant?: number | null;
      current_participants?: number | null;
    }>;

    const bases = rows.map((s) => coachPayoutUsd(s));
    const sumB = bases.reduce((a, b) => a + b, 0);
    const count = rows.length;

    const useTotal =
      totalAmount != null && !Number.isNaN(totalAmount) && totalAmount >= 0;

    /** Per-session payout to persist */
    const allocated: number[] = (() => {
      if (!useTotal) {
        return bases.map((b) => Math.round(b * 100) / 100);
      }
      const T = Math.round(totalAmount! * 100) / 100;
      if (count === 0) return [];
      if (sumB <= 0) {
        const out: number[] = [];
        let allocatedSum = 0;
        const per = Math.round((T / count) * 100) / 100;
        for (let i = 0; i < count; i++) {
          if (i === count - 1) {
            out.push(Math.round((T - allocatedSum) * 100) / 100);
          } else {
            out.push(per);
            allocatedSum += per;
          }
        }
        return out;
      }
      const out: number[] = [];
      let allocatedSum = 0;
      for (let i = 0; i < count; i++) {
        if (i === count - 1) {
          out.push(Math.round((T - allocatedSum) * 100) / 100);
        } else {
          const share = Math.round((T * (bases[i]! / sumB)) * 100) / 100;
          out.push(share);
          allocatedSum += share;
        }
      }
      return out;
    })();

    for (let i = 0; i < rows.length; i++) {
      const s = rows[i]!;
      const payment = allocated[i] ?? 0;
      const updates: { athlete_payout_date: string; athlete_payment: number } = {
        athlete_payout_date: today,
        athlete_payment: payment,
      };
      const { error: updateError } = await admin.from('sessions').update(updates).eq('id', s.id);
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
