import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { transferSessionRegistration } from '@/lib/transfer-session-registration';

/**
 * Transfer a participant registration from one session to another.
 * Preserves payment information.
 */
export async function POST(req: NextRequest) {
  try {
    const hdrs = await headers();
    const host = hdrs.get('host') ?? '';
    const tenant = getTenantByDomain(host);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    const { participantId, fromSessionId, toSessionId } = await req.json();

    const admin = createAdminClient(tenant.slug);
    const result = await transferSessionRegistration(admin, {
      participantId,
      fromSessionId,
      toSessionId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Registration transferred successfully',
      participantId: result.participantId,
      fromSessionId: result.fromSessionId,
      toSessionId: result.toSessionId,
      amountPaid: result.amountPaid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
