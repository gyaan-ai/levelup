'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export type UserCredit = {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  source_type: 'cancellation' | 'refund' | 'manual' | 'promo';
  source_id: string | null;
  expires_at: string;
  used_at: string | null;
  used_for_session_id: string | null;
  created_at: string;
};

/**
 * Get total available (unused, non-expired) credit balance for a user
 */
export async function getUserCreditBalance(userId: string): Promise<number> {
  const admin = createAdminClient();
  
  const { data, error } = await admin
    .from('user_credits')
    .select('amount')
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Error fetching credit balance:', error);
    return 0;
  }

  return data?.reduce((sum, credit) => sum + Number(credit.amount), 0) ?? 0;
}

/**
 * Get all available credits for a user (for display purposes)
 */
export async function getUserCredits(userId: string): Promise<UserCredit[]> {
  const admin = createAdminClient();
  
  const { data, error } = await admin
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true }); // Use oldest expiring first

  if (error) {
    console.error('Error fetching credits:', error);
    return [];
  }

  return data ?? [];
}

/**
 * Grant credit to a user (e.g., after session cancellation)
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
  // Use admin client to bypass RLS for granting credits
  const admin = createAdminClient(tenantSlug);

  // Create the credit
  const { data: credit, error: creditError } = await admin
    .from('user_credits')
    .insert({
      user_id: userId,
      amount,
      reason,
      source_type: sourceType,
      source_id: sourceId ?? null,
    })
    .select('id')
    .single();

  if (creditError) {
    console.error('Error granting credit:', creditError);
    return { success: false, error: creditError.message };
  }

  // Log the transaction
  await admin.from('credit_transactions').insert({
    user_id: userId,
    credit_id: credit.id,
    amount,
    type: 'credit',
    description: reason,
  });

  return { success: true, creditId: credit.id };
}

/**
 * Apply credits for a session purchase
 * Returns the amount of credits actually used
 */
export async function applyCredits({
  userId,
  amount,
  sessionId,
  description,
  tenantSlug,
}: {
  userId: string;
  amount: number;
  sessionId: string;
  description: string;
  tenantSlug?: string;
}): Promise<{ usedAmount: number; creditIds: string[] }> {
  // Use admin client to bypass RLS for using credits
  const admin = createAdminClient(tenantSlug);

  // Get available credits ordered by expiration (use oldest first)
  const credits = await getUserCredits(userId);
  
  let remainingToUse = amount;
  const usedCreditIds: string[] = [];

  for (const credit of credits) {
    if (remainingToUse <= 0) break;

    const creditAmount = Number(credit.amount);
    const amountToUse = Math.min(creditAmount, remainingToUse);

    if (amountToUse === creditAmount) {
      // Use entire credit
      await admin
        .from('user_credits')
        .update({
          used_at: new Date().toISOString(),
          used_for_session_id: sessionId,
        })
        .eq('id', credit.id);
    } else {
      // Partial use - mark original as used and create new credit for remainder
      await admin
        .from('user_credits')
        .update({
          used_at: new Date().toISOString(),
          used_for_session_id: sessionId,
          amount: amountToUse, // Update to reflect what was actually used
        })
        .eq('id', credit.id);

      // Create new credit for the remainder
      await admin.from('user_credits').insert({
        user_id: userId,
        amount: creditAmount - amountToUse,
        reason: `Remainder from partial credit use`,
        source_type: credit.source_type,
        source_id: credit.source_id,
        expires_at: credit.expires_at,
      });
    }

    // Log the debit transaction
    await admin.from('credit_transactions').insert({
      user_id: userId,
      credit_id: credit.id,
      amount: -amountToUse,
      type: 'debit',
      description,
      session_id: sessionId,
    });

    usedCreditIds.push(credit.id);
    remainingToUse -= amountToUse;
  }

  return {
    usedAmount: amount - remainingToUse,
    creditIds: usedCreditIds,
  };
}

/**
 * Get credit transaction history for a user
 */
export async function getCreditHistory(userId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching credit history:', error);
    return [];
  }

  return data ?? [];
}
