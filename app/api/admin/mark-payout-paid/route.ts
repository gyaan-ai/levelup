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

    const today = new Date().toISOString().slice(0, 10);
    const admin = createAdminClient(tenant.slug);

    const { data: updated, error: updateError } = await admin
      .from('sessions')
      .update({ athlete_payout_date: today })
      .eq('athlete_id', athleteId)
      .eq('status', 'completed')
      .is('athlete_payout_date', null)
      .select('id');

    if (updateError) {
      console.error('Mark payout paid error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const updatedCount = updated?.length ?? 0;
    return NextResponse.json({ success: true, updatedCount });
  } catch (e) {
    console.error('Mark payout paid error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
