import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

// GET /api/credits - Get current user's credit balance and history
export async function GET(req: NextRequest) {
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

    // Get all credits for this user
    const { data: credits, error } = await supabase
      .from('credits')
      .select('*')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch credits:', error);
      return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
    }

    // Calculate total available balance (non-expired credits with remaining > 0)
    const now = new Date();
    const availableCredits = (credits || []).filter(c => 
      c.remaining > 0 && (!c.expires_at || new Date(c.expires_at) > now)
    );
    const totalBalance = availableCredits.reduce((sum, c) => sum + Number(c.remaining), 0);

    return NextResponse.json({
      balance: totalBalance,
      credits: credits || [],
      availableCredits,
    });
  } catch (e) {
    console.error('Credits API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
