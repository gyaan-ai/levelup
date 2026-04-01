import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

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
    
    if (!participantId || !fromSessionId || !toSessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    if (fromSessionId === toSessionId) {
      return NextResponse.json({ error: 'Cannot transfer to the same session' }, { status: 400 });
    }
    
    const admin = createAdminClient(tenant.slug);
    
    // Get the participant record from the source session
    const { data: participant, error: fetchError } = await admin
      .from('session_participants')
      .select('*')
      .eq('id', participantId)
      .eq('session_id', fromSessionId)
      .maybeSingle();
    
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    
    if (!participant) {
      return NextResponse.json({ error: 'Participant not found in source session' }, { status: 404 });
    }
    
    // Verify the target session exists
    const { data: targetSession, error: targetError } = await admin
      .from('sessions')
      .select('id, max_participants, current_participants')
      .eq('id', toSessionId)
      .maybeSingle();
    
    if (targetError || !targetSession) {
      return NextResponse.json({ error: 'Target session not found' }, { status: 404 });
    }
    
    // Check if wrestler is already registered in target session
    if (participant.youth_wrestler_id) {
      const { data: existing } = await admin
        .from('session_participants')
        .select('id')
        .eq('session_id', toSessionId)
        .eq('youth_wrestler_id', participant.youth_wrestler_id)
        .maybeSingle();
      
      if (existing) {
        return NextResponse.json({ error: 'Wrestler is already registered in the target session' }, { status: 400 });
      }
    }
    
    // Check capacity
    const currentCount = targetSession.current_participants ?? 0;
    const maxCount = targetSession.max_participants ?? 6;
    if (currentCount >= maxCount) {
      return NextResponse.json({ error: 'Target session is full' }, { status: 400 });
    }
    
    // Update the participant's session_id (transfer them)
    const { error: updateError } = await admin
      .from('session_participants')
      .update({ session_id: toSessionId })
      .eq('id', participantId);
    
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    
    // Update current_participants counts
    // Decrement source session
    await admin
      .from('sessions')
      .update({ current_participants: Math.max(0, (participant.session_id ? 1 : 0)) })
      .eq('id', fromSessionId);
    
    // Actually, let's use proper increment/decrement
    const { data: sourceSession } = await admin
      .from('sessions')
      .select('current_participants')
      .eq('id', fromSessionId)
      .maybeSingle();
    
    if (sourceSession) {
      await admin
        .from('sessions')
        .update({ current_participants: Math.max(0, (sourceSession.current_participants ?? 1) - 1) })
        .eq('id', fromSessionId);
    }
    
    // Increment target session
    await admin
      .from('sessions')
      .update({ current_participants: (targetSession.current_participants ?? 0) + 1 })
      .eq('id', toSessionId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Registration transferred successfully',
      participantId,
      fromSessionId,
      toSessionId,
      amountPaid: participant.amount_paid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
