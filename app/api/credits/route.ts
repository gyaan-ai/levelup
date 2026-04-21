import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { getUserCreditBalance, getUserCredits, getCreditHistory } from '@/lib/credits';
import { getWalletLedger, isRewardsProgramEnabled } from '@/lib/rewards';

// GET /api/credits - Get current user's credit balance and history
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const supabase = await createClient(tenant.slug);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rewardsOn = isRewardsProgramEnabled();
    const [balance, credits, history, ledger] = await Promise.all([
      getUserCreditBalance(user.id, tenant.slug),
      getUserCredits(user.id, tenant.slug),
      getCreditHistory(user.id, tenant.slug),
      rewardsOn ? getWalletLedger(user.id, tenant.slug, 150) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      rewardsEnabled: rewardsOn,
      balance,
      credits: credits.map(c => ({
        id: c.id,
        amount: Number(c.amount),
        remaining: Number(c.remaining),
        reason: c.reason,
        sourceType: c.source_type,
        expiresAt: c.expires_at,
        createdAt: c.created_at,
      })),
      history: history.map(h => ({
        id: h.id,
        amount: Number(h.amount),
        type: h.type,
        description: h.description,
        createdAt: h.created_at,
      })),
      ledger: ledger.map((row) => ({
        id: row.id,
        kind: row.kind,
        amount: row.amount,
        description: row.description,
        createdAt: row.createdAt,
        rewardType: row.rewardType,
        sessionId: row.sessionId,
      })),
    });
  } catch (e) {
    console.error('Credits API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
