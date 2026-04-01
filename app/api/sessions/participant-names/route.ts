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
    
    const { sessionIds } = await req.json();
    
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ names: {} });
    }

    const admin = createAdminClient(tenant.slug);

    // Fetch all participants for these sessions
    const { data: participants } = await admin
      .from('session_participants')
      .select('session_id, youth_wrestler_id, roster_first_name, roster_last_name')
      .in('session_id', sessionIds);

    if (!participants || participants.length === 0) {
      return NextResponse.json({ names: {} });
    }

    // Get unique youth wrestler IDs
    const youthIds = [...new Set(participants.map(p => p.youth_wrestler_id).filter(Boolean))] as string[];
    
    // Fetch wrestler names
    const wrestlerMap: Record<string, { first_name: string; last_name: string }> = {};
    if (youthIds.length > 0) {
      const { data: wrestlers } = await admin
        .from('youth_wrestlers')
        .select('id, first_name, last_name')
        .in('id', youthIds);
      
      if (wrestlers) {
        for (const w of wrestlers) {
          wrestlerMap[w.id] = { first_name: w.first_name ?? '', last_name: w.last_name ?? '' };
        }
      }
    }

    // Build names by session
    const namesBySession: Record<string, string[]> = {};
    for (const p of participants) {
      const sessionId = p.session_id;
      if (!namesBySession[sessionId]) {
        namesBySession[sessionId] = [];
      }
      
      // Try roster_first_name/roster_last_name first, then youth_wrestlers
      let name = '';
      if (p.roster_first_name || p.roster_last_name) {
        name = `${p.roster_first_name || ''} ${p.roster_last_name || ''}`.trim();
      } else if (p.youth_wrestler_id && wrestlerMap[p.youth_wrestler_id]) {
        const w = wrestlerMap[p.youth_wrestler_id];
        name = `${w.first_name} ${w.last_name}`.trim();
      }
      
      if (name) {
        namesBySession[sessionId].push(name);
      }
    }

    // Convert to comma-separated strings
    const names: Record<string, string> = {};
    for (const [sessionId, nameList] of Object.entries(namesBySession)) {
      names[sessionId] = nameList.join(', ');
    }

    return NextResponse.json({ names });
  } catch (err) {
    console.error('Error fetching participant names:', err);
    return NextResponse.json({ names: {} });
  }
}
