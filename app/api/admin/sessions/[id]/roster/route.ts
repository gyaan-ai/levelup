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

    // Fetch session with participants via JOIN - only columns that exist
    let sessionData: Record<string, unknown> | null = null;
    let error: { message: string } | null = null;
    const res1 = await admin
      .from('sessions')
      .select(
        'id, session_participants(id, amount_paid, youth_wrestler_id, stripe_payment_intent_id)'
      )
      .eq('id', sessionId)
      .maybeSingle();
    sessionData = res1.data as Record<string, unknown> | null;
    error = res1.error;

    if (error && (error.message ?? '').includes('stripe_payment_intent_id')) {
      const res2 = await admin
        .from('sessions')
        .select('id, session_participants(id, amount_paid, youth_wrestler_id)')
        .eq('id', sessionId)
        .maybeSingle();
      sessionData = res2.data as Record<string, unknown> | null;
      error = res2.error;
    }

    if (error) {
      return NextResponse.json({ roster: [], error: error.message }, { status: 500 });
    }

    if (!sessionData) {
      return NextResponse.json({ roster: [] });
    }

    // Extract participants
    const raw = sessionData.session_participants;
    const participants = Array.isArray(raw) ? raw : raw ? [raw] : [];

    // Get youth wrestler IDs to look up names
    const youthIds = participants
      .map((p: Record<string, unknown>) => p.youth_wrestler_id as string)
      .filter(Boolean);
    
    // Fetch wrestler names
    const wrestlerNames: Record<string, { first_name: string; last_name: string; photo_url: string | null }> = {};
    if (youthIds.length > 0) {
      const { data: wrestlers } = await admin
        .from('youth_wrestlers')
        .select('id, first_name, last_name, photo_url')
        .in('id', youthIds);
      
      if (wrestlers) {
        for (const w of wrestlers) {
          wrestlerNames[w.id] = { first_name: w.first_name, last_name: w.last_name, photo_url: w.photo_url };
        }
      }
    }

    // Build roster
    const roster = participants.map((p: Record<string, unknown>) => {
      const youthId = p.youth_wrestler_id as string | null;
      const wrestler = youthId ? wrestlerNames[youthId] : null;
      const name = wrestler ? `${wrestler.first_name} ${wrestler.last_name}`.trim() : 'Drop-in';
      const stripePi = p.stripe_payment_intent_id as string | null | undefined;
      /** Admin drop-ins / manual rows; Stripe checkout rows carry PI and must not be deleted here. */
      const canDelete =
        stripePi === undefined ? true : !stripePi || String(stripePi).trim() === '';
      return {
        id: p.id as string,
        wrestlerName: name,
        photoUrl: wrestler?.photo_url || null,
        parentEmail: null,
        paid: Number(p.amount_paid ?? 0) > 0,
        amountPaid: Number(p.amount_paid ?? 0),
        isDropIn: youthId === null,
        canDelete,
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
