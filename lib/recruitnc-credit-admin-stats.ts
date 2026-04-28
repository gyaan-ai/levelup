/** Description marker appended by RecruitNC → Guild grant route (survives in DB for auditing). */
export const RECRUITNC_ALLOCATION_DESC_MARKER = '[recruitnc_allocation:';

/** Rows funded from RecruitNC: new `recruitnc_transfer` source or legacy grants tagged in description. */
export function isRecruitNcCreditRow(row: {
  source?: string | null;
  description?: string | null;
}): boolean {
  if (String(row.source ?? '') === 'recruitnc_transfer') return true;
  const d = typeof row.description === 'string' ? row.description : '';
  return d.includes(RECRUITNC_ALLOCATION_DESC_MARKER);
}

export type RecruitNcCreditTotals = {
  grantRows: number;
  /** Sum of original `amount` on matching grant buckets. */
  totalGrantedUsd: number;
  /** Sum of `remaining` still in wallets. */
  remainingInWalletsUsd: number;
  /** Dollars from those buckets applied toward sessions (`credit_usage`). */
  spentAtCheckoutUsd: number;
};

export function rollupRecruitNcGrantRowsUsd(
  rows: Array<{ amount?: unknown; remaining?: unknown }>
): Omit<RecruitNcCreditTotals, 'spentAtCheckoutUsd'> {
  let totalGrantedUsd = 0;
  let remainingInWalletsUsd = 0;
  for (const r of rows) {
    totalGrantedUsd += Number(r.amount ?? 0);
    remainingInWalletsUsd += Number(r.remaining ?? 0);
  }
  return {
    grantRows: rows.length,
    totalGrantedUsd: Math.round(totalGrantedUsd * 100) / 100,
    remainingInWalletsUsd: Math.round(remainingInWalletsUsd * 100) / 100,
  };
}
