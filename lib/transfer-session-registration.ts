import type { SupabaseClient } from '@supabase/supabase-js';

/** Set sessions.current_participants from actual session_participants rows (fixes drift). */
export async function syncSessionParticipantCount(
  admin: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { count, error } = await admin
    .from('session_participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  if (error) return;
  await admin
    .from('sessions')
    .update({ current_participants: count ?? 0 })
    .eq('id', sessionId);
}

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

  const { count: targetRowCount } = await admin
    .from('session_participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', toSessionId);
  const filled = targetRowCount ?? 0;
  const maxCount = targetSession.max_participants ?? 6;
  if (filled >= maxCount) {
    return { ok: false, status: 400, error: 'Target session is full' };
  }

  const { data: updatedRows, error: updateError } = await admin
    .from('session_participants')
    .update({ session_id: toSessionId })
    .eq('id', participantId)
    .eq('session_id', fromSessionId)
    .select('id');

  if (updateError) {
    return { ok: false, status: 500, error: updateError.message };
  }
  if (!updatedRows?.length) {
    return {
      ok: false,
      status: 409,
      error:
        'Could not move registration (participant may have already been moved or removed). Refresh and try again.',
    };
  }

  await syncSessionParticipantCount(admin, fromSessionId);
  await syncSessionParticipantCount(admin, toSessionId);

  return {
    ok: true,
    participantId,
    fromSessionId,
    toSessionId,
    amountPaid: participant.amount_paid,
  };
}
