import { createAdminClient } from '@/lib/supabase/admin';

/** Maps `public.credits` rows for callers that expect the legacy `UserCredit` shape. */
export type UserCredit = {
  id: string;
  user_id: string;
  /** Original issued amount */
  amount: number;
  /** Remaining on this row (use this for spending). */
  remaining: number;
  reason: string;
  source_type: string;
  source_id: string | null;
  expires_at: string | null;
  used_at: string | null;
  used_for_session_id: string | null;
  created_at: string;
};

function mapCreditRow(row: Record<string, unknown>): UserCredit {
  return {
    id: row.id as string,
    user_id: row.parent_id as string,
    amount: Number(row.amount ?? 0),
    remaining: Number(row.remaining ?? 0),
    reason: (row.description as string) ?? '',
    source_type: String(row.source ?? ''),
    source_id: (row.source_session_id as string) ?? null,
    expires_at: (row.expires_at as string) ?? null,
    used_at: null,
    used_for_session_id: null,
    created_at: row.created_at as string,
  };
}

function mapGrantSource(
  sourceType: 'cancellation' | 'refund' | 'manual' | 'promo'
): 'cancellation' | 'coach_cancellation' | 'admin_grant' | 'promotion' {
  if (sourceType === 'cancellation' || sourceType === 'refund') return 'cancellation';
  if (sourceType === 'promo') return 'promotion';
  return 'admin_grant';
}

/**
 * Total available Guild credit for a parent (`public.credits`: parent_id, remaining).
 */
export async function getUserCreditBalance(userId: string, tenantSlug = 'guild'): Promise<number> {
  const admin = createAdminClient(tenantSlug);
  const nowIso = new Date().toISOString();

  const { data, error } = await admin
    .from('credits')
    .select('remaining, expires_at')
    .eq('parent_id', userId)
    .gt('remaining', 0);

  if (error) {
    console.error('Error fetching credit balance:', error);
    return 0;
  }

  return (data ?? []).reduce((sum, row: { remaining: unknown; expires_at: string | null }) => {
    if (row.expires_at && row.expires_at <= nowIso) return sum;
    return sum + Number(row.remaining ?? 0);
  }, 0);
}

/**
 * Available credit rows for display / FIFO apply.
 */
export async function getUserCredits(userId: string, tenantSlug = 'guild'): Promise<UserCredit[]> {
  const admin = createAdminClient(tenantSlug);
  const nowIso = new Date().toISOString();

  const { data, error } = await admin
    .from('credits')
    .select('*')
    .eq('parent_id', userId)
    .gt('remaining', 0)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('expires_at', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching credits:', error);
    return [];
  }

  return (data ?? []).map((row) => mapCreditRow(row as Record<string, unknown>));
}

/**
 * Grant credit (`public.credits`) — e.g. after cancellation.
 */
export async function grantCredit({
  userId,
  amount,
  reason,
  sourceType,
  sourceId,
  tenantSlug,
}: {
  userId: string;
  amount: number;
  reason: string;
  sourceType: 'cancellation' | 'refund' | 'manual' | 'promo';
  sourceId?: string;
  tenantSlug?: string;
}): Promise<{ success: boolean; creditId?: string; error?: string }> {
  const admin = createAdminClient(tenantSlug ?? 'guild');

  const { data: credit, error: creditError } = await admin
    .from('credits')
    .insert({
      parent_id: userId,
      amount,
      remaining: amount,
      source: mapGrantSource(sourceType),
      source_session_id: sourceId ?? null,
      description: reason,
      expires_at: null,
    })
    .select('id')
    .single();

  if (creditError) {
    console.error('Error granting credit:', creditError);
    return { success: false, error: creditError.message };
  }

  return { success: true, creditId: credit.id as string };
}

/**
 * Apply credits toward a session: decrement `remaining`, append `credit_usage` rows.
 */
export async function applyCredits({
  userId,
  amount,
  sessionId,
  description: _description,
  tenantSlug,
}: {
  userId: string;
  amount: number;
  sessionId: string;
  description: string;
  tenantSlug?: string;
}): Promise<{ usedAmount: number; creditIds: string[] }> {
  void _description;
  const admin = createAdminClient(tenantSlug ?? 'guild');
  const credits = await getUserCredits(userId, tenantSlug ?? 'guild');

  let remainingToUse = amount;
  const usedCreditIds: string[] = [];
  const nowIso = new Date().toISOString();

  for (const credit of credits) {
    if (remainingToUse <= 0) break;

    const available = Number(credit.remaining);
    if (available <= 0) continue;

    const amountToUse = Math.min(available, remainingToUse);
    const newRemaining = available - amountToUse;

    const { error: updErr } = await admin
      .from('credits')
      .update({ remaining: newRemaining, updated_at: nowIso })
      .eq('id', credit.id);

    if (updErr) {
      console.error('applyCredits update failed:', updErr);
      break;
    }

    const { error: useErr } = await admin.from('credit_usage').insert({
      credit_id: credit.id,
      session_id: sessionId,
      amount: amountToUse,
    });

    if (useErr) {
      console.error('applyCredits credit_usage insert failed:', useErr);
      await admin
        .from('credits')
        .update({ remaining: available, updated_at: nowIso })
        .eq('id', credit.id);
      break;
    }

    usedCreditIds.push(credit.id);
    remainingToUse -= amountToUse;
  }

  return {
    usedAmount: amount - remainingToUse,
    creditIds: usedCreditIds,
  };
}

/**
 * Total dollars already applied from this parent’s wallet to a session (sum of `credit_usage.amount`
 * for credits owned by `parentId` and this `sessionId`). Used to recover from “credits debited but
 * roster insert failed” without double-charging on retry. Not sufficient when multiple children share
 * one session via separate checkouts — callers must adjust `needApply` when the parent already has
 * other kids on this session (see register / cart).
 */
export async function getCreditUsageSumForParentSession(
  parentId: string,
  sessionId: string,
  tenantSlug = 'guild'
): Promise<number> {
  const admin = createAdminClient(tenantSlug);
  const { data: creditRows, error: cErr } = await admin.from('credits').select('id').eq('parent_id', parentId);
  if (cErr || !creditRows?.length) return 0;
  const ids = creditRows.map((c: { id: string }) => c.id);
  const { data: usage, error: uErr } = await admin
    .from('credit_usage')
    .select('amount')
    .eq('session_id', sessionId)
    .in('credit_id', ids);
  if (uErr) return 0;
  return (usage ?? []).reduce((s, row: { amount?: unknown }) => s + Number(row.amount ?? 0), 0);
}

/** Recent credit applications for wallet / API (from `credit_usage`). */
export async function getCreditHistory(userId: string, tenantSlug = 'guild') {
  const admin = createAdminClient(tenantSlug);

  const { data: creditRows, error: cErr } = await admin.from('credits').select('id').eq('parent_id', userId);
  if (cErr) {
    console.error('Error fetching credit history (credits):', cErr);
    return [];
  }
  const ids = (creditRows ?? []).map((c: { id: string }) => c.id);
  if (ids.length === 0) return [];

  const { data, error } = await admin
    .from('credit_usage')
    .select('id, amount, session_id, created_at, credit_id')
    .in('credit_id', ids)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching credit history:', error);
    return [];
  }

  return (data ?? []).map(
    (u: { id: string; amount: unknown; session_id: string | null; created_at: string; credit_id: string }) => ({
      id: u.id,
      amount: -Math.abs(Number(u.amount)),
      type: 'debit' as const,
      description: 'Applied to booking',
      created_at: u.created_at,
      session_id: u.session_id,
      credit_id: u.credit_id,
    })
  );
}
