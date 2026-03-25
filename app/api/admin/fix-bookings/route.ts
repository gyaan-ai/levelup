import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { wrestlerName, sessionIds, tenantSlug = 'guild' } = await req.json();
    
    if (!wrestlerName || !sessionIds || !Array.isArray(sessionIds)) {
      return NextResponse.json({ error: 'Missing wrestlerName or sessionIds' }, { status: 400 });
    }
    
    const supabase = createAdminClient(tenantSlug);
    
    // Find the youth wrestler
    const nameParts = wrestlerName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    
    const { data: wrestler, error: wrestlerError } = await supabase
      .from('youth_wrestlers')
      .select('id, first_name, last_name, photo_url, parent_id')
      .ilike('first_name', `%${firstName}%`)
      .ilike('last_name', `%${lastName}%`)
      .maybeSingle();
    
    if (wrestlerError || !wrestler) {
      return NextResponse.json({ 
        error: 'Wrestler not found', 
        details: wrestlerError?.message,
        searched: { firstName, lastName }
      }, { status: 404 });
    }
    
    const results: { sessionId: string; status: string; error?: string }[] = [];
    
    for (const sessionId of sessionIds) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', sessionId)
        .eq('youth_wrestler_id', wrestler.id)
        .maybeSingle();
      
      if (existing) {
        results.push({ sessionId, status: 'already_exists' });
        continue;
      }
      
      // Get session info
      const { data: session } = await supabase
        .from('sessions')
        .select('current_participants, price_per_participant')
        .eq('id', sessionId)
        .single();
      
      if (!session) {
        results.push({ sessionId, status: 'session_not_found' });
        continue;
      }
      
      // Insert participant
      const { error: insertError } = await supabase.from('session_participants').insert({
        session_id: sessionId,
        youth_wrestler_id: wrestler.id,
        parent_id: wrestler.parent_id,
        paid: true,
        amount_paid: session.price_per_participant || 0,
        payment_method: 'stripe',
        status: 'confirmed',
        roster_first_name: wrestler.first_name,
        roster_last_name: wrestler.last_name,
        roster_photo_url: wrestler.photo_url,
      });
      
      if (insertError) {
        results.push({ sessionId, status: 'error', error: insertError.message });
        continue;
      }
      
      // Update participant count
      const currentCount = session.current_participants || 0;
      await supabase
        .from('sessions')
        .update({ current_participants: currentCount + 1 })
        .eq('id', sessionId);
      
      results.push({ sessionId, status: 'created' });
    }
    
    return NextResponse.json({ 
      success: true, 
      wrestler: { id: wrestler.id, name: `${wrestler.first_name} ${wrestler.last_name}` },
      results 
    });
    
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
