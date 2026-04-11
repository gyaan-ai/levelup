import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zOptionalCheckbox, zRequiredAgreementCheckbox } from './zod-checkbox';

describe('zOptionalCheckbox', () => {
  const schema = z.object({ ok: zOptionalCheckbox });

  it('treats undefined and false as false', () => {
    expect(schema.parse({ ok: undefined }).ok).toBe(false);
    expect(schema.parse({ ok: false }).ok).toBe(false);
  });

  it('treats true as true', () => {
    expect(schema.parse({ ok: true }).ok).toBe(true);
  });
});

describe('zRequiredAgreementCheckbox', () => {
  const schema = z.object({ agree: zRequiredAgreementCheckbox('must agree') });

  it('rejects false', () => {
    expect(() => schema.parse({ agree: false })).toThrow();
  });

  it('accepts true', () => {
    expect(schema.parse({ agree: true }).agree).toBe(true);
  });
});
