import type { SupabaseClient } from '@supabase/supabase-js';

export type TransferSessionRegistrationResult =
  | {
      ok: true;
      participantId: string;
      fromSessionId: string;
      toSessionId: string;
      amountPaid: unknown;
    }
  | { ok: false; status: number; error: string };

/**
 * Move a session_participants row to another session and adjust capacity counts.
 * Caller must enforce authorization.
 */
export async function transferSessionRegistration(
  admin: SupabaseClient,
  params: { participantId: string; fromSessionId: string; toSessionId: string }
): Promise<TransferSessionRegistrationResult> {
  const { participantId, fromSessionId, toSessionId } = params;

  if (!participantId || !fromSessionId || !toSessionId) {
    return { ok: false, status: 400, error: 'Missing required fields' };
  }
  if (fromSessionId === toSessionId) {
    return { ok: false, status: 400, error: 'Cannot transfer to the same session' };
  }

  const { data: participant, error: fetchError } = await admin
    .from('session_participants')
    .select('*')
    .eq('id', participantId)
    .eq('session_id', fromSessionId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, status: 500, error: fetchError.message };
  }
  if (!participant) {
    return { ok: false, status: 404, error: 'Participant not found in source session' };
  }

  const { data: targetSession, error: targetError } = await admin
    .from('sessions')
    .select('id, max_participants, current_participants')
    .eq('id', toSessionId)
    .maybeSingle();

  if (targetError || !targetSession) {
    return { ok: false, status: 404, error: 'Target session not found' };
  }

  if (participant.youth_wrestler_id) {
    const { data: existing } = await admin
      .from('session_participants')
      .select('id')
      .eq('session_id', toSessionId)
      .eq('youth_wrestler_id', participant.youth_wrestler_id)
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        status: 400,
        error: 'Wrestler is already registered in the target session',
      };
    }
  }

  const currentCount = targetSession.current_participants ?? 0;
  const maxCount = targetSession.max_participants ?? 6;
  if (currentCount >= maxCount) {
    return { ok: false, status: 400, error: 'Target session is full' };
  }

  const { error: updateError } = await admin
    .from('session_participants')
    .update({ session_id: toSessionId })
    .eq('id', participantId);

  if (updateError) {
    return { ok: false, status: 500, error: updateError.message };
  }

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

  await admin
    .from('sessions')
    .update({ current_participants: (targetSession.current_participants ?? 0) + 1 })
    .eq('id', toSessionId);

  return {
    ok: true,
    participantId,
    fromSessionId,
    toSessionId,
    amountPaid: participant.amount_paid,
  };
}
