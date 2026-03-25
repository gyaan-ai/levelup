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
      .select('id, session_participants(id, paid, amount_paid, created_at, youth_wrestler_id, roster_first_name, roster_last_name, roster_photo_url)')
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

    // Build roster using snapshot data only
    const roster = participants.map((p: Record<string, unknown>) => {
      const firstName = (p.roster_first_name as string) || 'Drop-in';
      const lastName = (p.roster_last_name as string) || '';
      
      return {
        id: p.id as string,
        wrestlerName: `${firstName} ${lastName}`.trim(),
        photoUrl: (p.roster_photo_url as string) || null,
        parentEmail: null,
        paid: (p.paid as boolean) ?? false,
        amountPaid: Number(p.amount_paid ?? 0),
        isDropIn: p.youth_wrestler_id === null,
        createdAt: (p.created_at as string) || '',
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
    return NextResponse.json({ roster: [], error: String(err) }, { status: 500 });
  }
}
