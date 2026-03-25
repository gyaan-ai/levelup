import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const hdrs = await headers();
  const host = hdrs.get('host') ?? '';
  const tenant = getTenantByDomain(host);
  if (!tenant) {
    return NextResponse.json({ error: 'Unknown tenant' }, { status: 400 });
  }
  const admin = createAdminClient(tenant.slug);

  // Fetch session with participants via JOIN (same approach as page.tsx which works)
  const { data: sessionData, error } = await admin
    .from('sessions')
    .select(`
      id,
      session_participants(
        id,
        paid,
        amount_paid,
        created_at,
        youth_wrestler_id,
        parent_id,
        roster_first_name,
        roster_last_name,
        roster_photo_url
      )
    `)
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sessionData) {
    return NextResponse.json({ roster: [] });
  }

  // Extract participants from join result
  const rawParticipants = sessionData.session_participants as Array<{
    id: string;
    paid: boolean;
    amount_paid: number;
    created_at: string;
    youth_wrestler_id: string | null;
    parent_id: string | null;
    roster_first_name: string | null;
    roster_last_name: string | null;
    roster_photo_url: string | null;
  }> | null;
  const participants = Array.isArray(rawParticipants) ? rawParticipants : rawParticipants ? [rawParticipants] : [];

  // Get youth wrestler details for those with IDs
  const youthIds = (participants ?? [])
    .map(p => p.youth_wrestler_id)
    .filter((id): id is string => !!id);
  
  const parentIds = (participants ?? [])
    .map(p => p.parent_id)
    .filter((id): id is string => !!id);

  const [{ data: youthWrestlers }, { data: parents }] = await Promise.all([
    youthIds.length > 0
      ? admin.from('youth_wrestlers').select('id, first_name, last_name, photo_url').in('id', youthIds)
      : Promise.resolve({ data: [] }),
    parentIds.length > 0
      ? admin.from('users').select('id, email').in('id', parentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const youthMap = new Map((youthWrestlers ?? []).map(y => [y.id, y]));
  const parentMap = new Map((parents ?? []).map(p => [p.id, p]));

  // Build roster with names
  const roster = (participants ?? []).map(p => {
    const youth = p.youth_wrestler_id ? youthMap.get(p.youth_wrestler_id) : null;
    const parent = p.parent_id ? parentMap.get(p.parent_id) : null;
    
    // Use roster snapshot if available, otherwise live data
    const firstName = p.roster_first_name || youth?.first_name || 'Drop-in';
    const lastName = p.roster_last_name || youth?.last_name || '';
    const photoUrl = p.roster_photo_url || youth?.photo_url || null;
    
    return {
      id: p.id,
      wrestlerName: `${firstName} ${lastName}`.trim(),
      photoUrl,
      parentEmail: parent?.email || null,
      paid: p.paid,
      amountPaid: p.amount_paid,
      isDropIn: !p.youth_wrestler_id,
      createdAt: p.created_at,
    };
  });

  return NextResponse.json({ roster });
}
