import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { getUserCreditBalance, getUserCredits, getCreditHistory } from '@/lib/credits';

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

    const [balance, credits, history] = await Promise.all([
      getUserCreditBalance(user.id),
      getUserCredits(user.id),
      getCreditHistory(user.id),
    ]);

    return NextResponse.json({
      balance,
      credits: credits.map(c => ({
        id: c.id,
        amount: Number(c.amount),
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
    });
  } catch (e) {
    console.error('Credits API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
