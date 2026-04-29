import { describe, expect, it } from 'vitest';
import { sessionPricePerParticipantUsd } from './session-price';

describe('sessionPricePerParticipantUsd', () => {
  it('preserves explicit 0 (free/comp)', () => {
    expect(sessionPricePerParticipantUsd(0)).toBe(0);
  });

  it('falls back only when missing or invalid', () => {
    expect(sessionPricePerParticipantUsd(undefined)).toBe(30);
    expect(sessionPricePerParticipantUsd(null)).toBe(30);
    expect(sessionPricePerParticipantUsd(NaN)).toBe(30);
    expect(sessionPricePerParticipantUsd(Number.NaN)).toBe(30);
  });

  it('truncates negatives to 0', () => {
    expect(sessionPricePerParticipantUsd(-5)).toBe(0);
  });
});
