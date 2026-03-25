import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const hdrs = await headers();
    const host = hdrs.get('host') ?? '';
    const tenant = getTenantByDomain(host);
    
    if (!tenant) {
      return NextResponse.json({ roster: [] });
    }
    
    const admin = createAdminClient(tenant.slug);

    // Fetch session with participants via JOIN
    const { data: sessionData, error } = await admin
      .from('sessions')
      .select('id, session_participants(id, amount_paid, youth_wrestler_id, roster_first_name, roster_last_name, roster_photo_url)')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ roster: [], error: error.message }, { status: 500 });
    }

    if (!sessionData) {
      return NextResponse.json({ roster: [] });
    }

    // Extract participants
    const raw = sessionData.session_participants;
    const participants = Array.isArray(raw) ? raw : raw ? [raw] : [];

    // Build roster with name data
    const roster = participants.map((p: Record<string, unknown>) => {
      const firstName = (p.roster_first_name as string) || '';
      const lastName = (p.roster_last_name as string) || '';
      const name = `${firstName} ${lastName}`.trim() || (p.youth_wrestler_id ? 'Unknown' : 'Drop-in');
      return {
        id: p.id as string,
        wrestlerName: name,
        photoUrl: (p.roster_photo_url as string) || null,
        parentEmail: null,
        paid: Number(p.amount_paid ?? 0) > 0,
        amountPaid: Number(p.amount_paid ?? 0),
        isDropIn: p.youth_wrestler_id === null,
        createdAt: '',
      };
    });

    return NextResponse.json({ roster });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ roster: [], error: message, stack }, { status: 500 });
  }
}
