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

    // Fetch session with participants via JOIN - use exact same columns as page.tsx
    const { data: sessionData, error } = await admin
      .from('sessions')
      .select('id, session_participants(id, amount_paid, youth_wrestler_id)')
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

    // Build roster - only use columns that exist
    const roster = participants.map((p: Record<string, unknown>) => {
      return {
        id: p.id as string,
        wrestlerName: p.youth_wrestler_id ? `Wrestler ${(p.id as string).slice(0, 4)}` : 'Drop-in',
        photoUrl: null,
        parentEmail: null,
        paid: Number(p.amount_paid ?? 0) > 0,
        amountPaid: Number(p.amount_paid ?? 0),
        isDropIn: p.youth_wrestler_id === null,
        createdAt: '',
      };
    });

    return NextResponse.json({ 
      roster,
      debug: {
        host,
        sessionId,
        tenant: tenant.slug,
        sessionFound: !!sessionData,
        rawParticipantsCount: participants.length,
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ roster: [], error: message, stack }, { status: 500 });
  }
}
