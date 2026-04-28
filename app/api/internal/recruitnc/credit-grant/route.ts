import { NextRequest, NextResponse } from 'next/server';
import {
  handleRecruitncCreditGrant,
  parseIdempotencyKey,
  recruitncGrantBodySchema,
  validateRecruitncGrantHeaders,
} from '@/lib/recruitnc-credit-grant';

export const dynamic = 'force-dynamic';

/**
 * RecruitNC → Guild trusted credit grant (server-to-server).
 * Auth: x-guild-api-secret must match GUILD_API_SECRET. Idempotency: Idempotency-Key (UUID).
 */
export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-guild-api-secret');
  const auth = validateRecruitncGrantHeaders(secretHeader);
  if (auth === 'missing' || auth === 'wrong') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const idem = parseIdempotencyKey(request.headers.get('Idempotency-Key'));
  if (!idem.ok) {
    return NextResponse.json({ error: 'Idempotency-Key must be a UUID.' }, { status: 422 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 422 });
  }

  const parsed = recruitncGrantBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body.', details: parsed.error.flatten() }, { status: 422 });
  }

  const body = parsed.data;
  const prefix = body.guild_parent_id.slice(0, 8);
  console.info('recruitnc credit-grant request', {
    recruitnc_allocation_id: body.metadata.recruitnc_allocation_id,
    guild_parent_id_prefix: prefix,
  });

  return handleRecruitncCreditGrant({ idempotencyKey: idem.key, body });
}
