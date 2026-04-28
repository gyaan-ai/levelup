import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  amountCentsToDollars,
  balanceDollarsToCents,
  parseIdempotencyKey,
  recruitncGrantBodySchema,
  validateRecruitncGrantHeaders,
} from './recruitnc-credit-grant';

const sampleUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

describe('recruitnc credit grant contract', () => {
  it('amountCentsToDollars divides by 100', () => {
    expect(amountCentsToDollars(5000)).toBe(50);
    expect(amountCentsToDollars(1)).toBe(0.01);
    expect(amountCentsToDollars(101)).toBe(1.01);
  });

  it('balanceDollarsToCents rounds to integer cents', () => {
    expect(balanceDollarsToCents(125)).toBe(12500);
    expect(balanceDollarsToCents(12.345)).toBe(1235);
  });

  describe('parseIdempotencyKey', () => {
    it('accepts valid UUID strings', () => {
      const r = parseIdempotencyKey(sampleUuid);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.key).toBe(sampleUuid);
    });

    it('rejects missing or invalid key', () => {
      expect(parseIdempotencyKey(null).ok).toBe(false);
      expect(parseIdempotencyKey('').ok).toBe(false);
      expect(parseIdempotencyKey('not-a-uuid').ok).toBe(false);
    });
  });

  describe('recruitncGrantBodySchema', () => {
    it('parses promotion default and metadata', () => {
      const r = recruitncGrantBodySchema.safeParse({
        guild_parent_id: sampleUuid,
        amount_cents: 5000,
        description: 'RECRUITNC: Fundraising balance allocated to Guild credits',
        metadata: {
          recruitnc_allocation_id: sampleUuid,
          recruitnc_user_id: sampleUuid,
          athlete_id: sampleUuid,
          campaign: 'fayetteville_spartan',
          requested_at: '2026-04-28T12:00:00.000Z',
        },
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.source).toBe('promotion');
    });

    it('rejects invalid parent uuid', () => {
      const r = recruitncGrantBodySchema.safeParse({
        guild_parent_id: 'bad',
        amount_cents: 1,
        description: 'x',
        metadata: {
          recruitnc_allocation_id: sampleUuid,
          recruitnc_user_id: sampleUuid,
          requested_at: '2026-04-28T12:00:00.000Z',
        },
      });
      expect(r.success).toBe(false);
    });
  });

  describe('validateRecruitncGrantHeaders', () => {
    beforeEach(() => {
      vi.stubEnv('GUILD_API_SECRET', 'test-secret-value');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns ok when header matches', () => {
      expect(validateRecruitncGrantHeaders('test-secret-value')).toBe('ok');
    });

    it('returns missing when header absent', () => {
      expect(validateRecruitncGrantHeaders(null)).toBe('missing');
    });

    it('returns wrong when secret mismatch', () => {
      expect(validateRecruitncGrantHeaders('other')).toBe('wrong');
    });
  });
});
