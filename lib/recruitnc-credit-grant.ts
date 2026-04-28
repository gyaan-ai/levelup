import type { NextResponse } from 'next/server';
import { NextResponse as NextResponseCtor } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserCreditBalance, grantCredit } from '@/lib/credits';
import { RECRUITNC_ALLOCATION_DESC_MARKER } from '@/lib/recruitnc-credit-admin-stats';

/** v1 body `source` is for RecruitNC only; inserts use DB `recruitnc_transfer` + allocation marker in description. */
const allowedBodySources = ['promotion', 'admin_grant'] as const;

export const recruitncGrantMetadataSchema = z
  .object({
    recruitnc_allocation_id: z.string().uuid(),
    recruitnc_user_id: z.string().uuid(),
    athlete_id: z.union([z.string().uuid(), z.null()]).optional(),
    campaign: z.string().max(200).optional(),
    requested_at: z.string().max(100),
  })
  .passthrough();

export const recruitncGrantBodySchema = z.object({
  guild_parent_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
  source: z.enum(allowedBodySources).default('promotion'),
  description: z.string().min(1).max(600),
  metadata: recruitncGrantMetadataSchema,
});

export type RecruitncGrantBody = z.infer<typeof recruitncGrantBodySchema>;

export const RECRUITNC_GRANT_MAX_AMOUNT_CENTS = 100_000_00; // $100,000.00 — safety cap per request

/** Same UUID string as allocation id per contract. */
const uuidHeaderSchema = z.string().uuid();

/**
 * Half-up rounding to cents as dollars for DB ( DECIMAL(10,2) ).
 */
export function amountCentsToDollars(amountCents: number): number {
  return Math.round(amountCents) / 100;
}

export function balanceDollarsToCents(balanceDollars: number): number {
  return Math.round(balanceDollars * 100);
}

function buildCreditDescription(body: RecruitncGrantBody): string {
  const allocation = body.metadata.recruitnc_allocation_id;
  return `${body.description}\n${RECRUITNC_ALLOCATION_DESC_MARKER}${allocation}]`;
}

/**
 * Parent-only role can always hold `credits.parent_id`.
 * `users.role = 'admin'` rows can still be linked as primary or linked parent on youth wrestlers
 * (staff who also have kids in the app)—allow wallet credits for those without opening all admins.
 */
export async function guildUserEligibleForRecruitncWalletGrant(
  admin: SupabaseClient,
  guildParentId: string,
  role: string | null
): Promise<boolean> {
  if (role === 'parent') return true;
  if (role !== 'admin') return false;

  const { data: primary } = await admin
    .from('youth_wrestlers')
    .select('id')
    .eq('parent_id', guildParentId)
    .limit(1)
    .maybeSingle();

  if (primary) return true;

  const { data: linked } = await admin
    .from('youth_wrestler_parents')
    .select('id')
    .eq('parent_id', guildParentId)
    .limit(1)
    .maybeSingle();

  return !!linked;
}

export type RecruitncGrantSuccessJson = {
  ok: true;
  credit_ids: string[];
  balance_cents: number;
};

function isStoredSuccessPayload(v: unknown): v is RecruitncGrantSuccessJson {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    o.ok === true &&
    Array.isArray(o.credit_ids) &&
    o.credit_ids.every((id) => typeof id === 'string') &&
    typeof o.balance_cents === 'number'
  );
}

function successResponse(payload: RecruitncGrantSuccessJson): NextResponse {
  return NextResponseCtor.json(payload, { status: 200 });
}

/**
 * Trusted RecruitNC credit grant handler. No session auth — caller must validate x-guild-api-secret first.
 */
export async function handleRecruitncCreditGrant(opts: {
  idempotencyKey: string;
  body: RecruitncGrantBody;
  tenantSlug?: string;
}): Promise<NextResponse> {
  const tenantSlug = opts.tenantSlug ?? 'guild';
  const admin = createAdminClient(tenantSlug);
  const key = opts.idempotencyKey;

  const { data: existingRow } = await admin
    .from('recruitnc_credit_grant_idempotency')
    .select('response_json')
    .eq('idempotency_key', key)
    .maybeSingle();

  const cachedPayload = existingRow?.response_json;
  if (isStoredSuccessPayload(cachedPayload)) {
    return successResponse(cachedPayload);
  }

  if (existingRow && existingRow.response_json === null) {
    return NextResponseCtor.json(
      { error: 'Grant in progress for this idempotency key; retry shortly.' },
      { status: 503 }
    );
  }

  const { error: claimErr } = await admin.from('recruitnc_credit_grant_idempotency').insert({
    idempotency_key: key,
    response_json: null,
  });

  if (claimErr) {
    const code = (claimErr as { code?: string }).code;
    if (code === '23505') {
      const { data: after } = await admin
        .from('recruitnc_credit_grant_idempotency')
        .select('response_json')
        .eq('idempotency_key', key)
        .maybeSingle();
      if (isStoredSuccessPayload(after?.response_json)) {
        return successResponse(after.response_json);
      }
      return NextResponseCtor.json({ error: 'Duplicate idempotency key; grant not complete.' }, { status: 503 });
    }
    console.error('recruitnc grant claim insert:', claimErr.message);
    return NextResponseCtor.json({ error: 'Idempotency store failed.' }, { status: 500 });
  }

  const body = opts.body;

  try {
    if (opts.body.amount_cents > RECRUITNC_GRANT_MAX_AMOUNT_CENTS) {
      await admin.from('recruitnc_credit_grant_idempotency').delete().eq('idempotency_key', key);
      return NextResponseCtor.json({ error: 'amount_cents exceeds server cap.' }, { status: 422 });
    }

    const { data: parent, error: parentErr } = await admin
      .from('users')
      .select('id, role')
      .eq('id', body.guild_parent_id)
      .maybeSingle();

    if (parentErr || !parent) {
      await admin.from('recruitnc_credit_grant_idempotency').delete().eq('idempotency_key', key);
      return NextResponseCtor.json({ error: 'guild_parent_id not found.' }, { status: 404 });
    }

    const eligible = await guildUserEligibleForRecruitncWalletGrant(admin, body.guild_parent_id, parent.role);
    if (!eligible) {
      await admin.from('recruitnc_credit_grant_idempotency').delete().eq('idempotency_key', key);
      return NextResponseCtor.json(
        {
          error:
            'guild_parent_id is not eligible for wallet credits (requires role parent, or admin linked as primary/linked parent on a youth wrestler).',
        },
        { status: 404 }
      );
    }

    const dollars = amountCentsToDollars(body.amount_cents);
    const description = buildCreditDescription(body);

    /** DB `recruitnc_transfer` — body `source` is ignored for tagging (audit in description). */
    const grantResult = await grantCredit({
      userId: body.guild_parent_id,
      amount: dollars,
      reason: description,
      sourceType: 'recruitnc',
      tenantSlug,
    });

    if (!grantResult.success || !grantResult.creditId) {
      await admin.from('recruitnc_credit_grant_idempotency').delete().eq('idempotency_key', key);
      return NextResponseCtor.json({ error: grantResult.error ?? 'Grant failed.' }, { status: 500 });
    }

    const balanceDollars = await getUserCreditBalance(body.guild_parent_id, tenantSlug);
    const balanceCents = balanceDollarsToCents(balanceDollars);
    const payload: RecruitncGrantSuccessJson = {
      ok: true,
      credit_ids: [grantResult.creditId],
      balance_cents: balanceCents,
    };

    await admin
      .from('recruitnc_credit_grant_idempotency')
      .update({ response_json: payload as unknown as Record<string, unknown> })
      .eq('idempotency_key', key);

    return successResponse(payload);
  } catch (e) {
    console.error('recruitnc credit grant:', e);
    await admin.from('recruitnc_credit_grant_idempotency').delete().eq('idempotency_key', key);
    return NextResponseCtor.json({ error: 'Internal error.' }, { status: 500 });
  }
}

export function validateRecruitncGrantHeaders(secretFromHeader: string | null): 'missing' | 'wrong' | 'ok' {
  const configured = process.env.GUILD_API_SECRET ?? '';
  if (!configured.trim()) return 'wrong';
  if (!secretFromHeader) return 'missing';
  if (secretFromHeader !== configured) return 'wrong';
  return 'ok';
}

export function parseIdempotencyKey(header: string | null): { ok: true; key: string } | { ok: false } {
  if (!header) return { ok: false };
  const parsed = uuidHeaderSchema.safeParse(header.trim());
  if (!parsed.success) return { ok: false };
  return { ok: true, key: parsed.data };
}
