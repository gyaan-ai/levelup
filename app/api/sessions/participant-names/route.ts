import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function POST(req: NextRequest) {
  try {
    const hdrs = await headers();
    const host = hdrs.get('host') ?? '';
    const tenant = getTenantByDomain(host);
    
    if (!tenant) {
      return NextResponse.json({ names: {} });
    }
    
    const body = await req.json();
    const rawIds = body?.sessionIds;
    
    if (!rawIds || !Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ names: {} });
    }
    
    // Filter to only valid UUID strings
    const sessionIds = rawIds.filter((id): id is string => 
      typeof id === 'string' && id.length > 0
    );
    
    if (sessionIds.length === 0) {
      return NextResponse.json({ names: {} });
    }

    const admin = createAdminClient(tenant.slug);
    const names: Record<string, string> = {};

    // Batch fetch all sessions with participants
    const { data: sessionsData } = await admin
      .from('sessions')
      .select('id, session_participants(id, youth_wrestler_id)')
      .in('id', sessionIds);

    if (!sessionsData || sessionsData.length === 0) {
      return NextResponse.json({ names: {} });
    }

    // Collect all youth wrestler IDs
    const allYouthIds: string[] = [];
    for (const session of sessionsData) {
      const raw = session.session_participants;
      const participants = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const p of participants) {
        const youthId = (p as Record<string, unknown>).youth_wrestler_id as string | null;
        if (youthId) allYouthIds.push(youthId);
      }
    }

    if (allYouthIds.length === 0) {
      return NextResponse.json({ names: {} });
    }

    // Fetch all wrestlers at once
    const uniqueYouthIds = [...new Set(allYouthIds)];
    const { data: wrestlers } = await admin
      .from('youth_wrestlers')
      .select('id, first_name, last_name')
      .in('id', uniqueYouthIds);

    const wrestlerMap: Record<string, string> = {};
    for (const w of wrestlers ?? []) {
      wrestlerMap[w.id] = `${w.first_name || ''} ${w.last_name || ''}`.trim();
    }

    // Build names for each session
    for (const session of sessionsData) {
      const raw = session.session_participants;
      const participants = Array.isArray(raw) ? raw : raw ? [raw] : [];
      
      const sessionNames = participants
        .map((p) => {
          const youthId = (p as Record<string, unknown>).youth_wrestler_id as string | null;
          return youthId ? wrestlerMap[youthId] : null;
        })
        .filter(Boolean) as string[];
      
      if (sessionNames.length > 0) {
        names[session.id] = sessionNames.join(', ');
      }
    }

    return NextResponse.json({ names });
  } catch (err) {
    console.error('Error fetching participant names:', err);
    return NextResponse.json({ names: {} });
  }
}
