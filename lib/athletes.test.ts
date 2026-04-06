import { describe, expect, it } from 'vitest';
import { isBackgroundCheckValidForDisplay, isSafeSportValidForDisplay } from './athletes';

describe('isBackgroundCheckValidForDisplay', () => {
  it('is true when coach attested (background_check) even if stored date is in the past', () => {
    expect(
      isBackgroundCheckValidForDisplay({
        background_check: true,
        background_check_expiration: '2020-01-15',
      })
    ).toBe(true);
  });

  it('is false when not attested and only a past date exists', () => {
    expect(
      isBackgroundCheckValidForDisplay({
        background_check: false,
        background_check_expiration: '2020-01-15',
      })
    ).toBe(false);
  });

  it('is true for legacy future expiration when boolean unset', () => {
    expect(
      isBackgroundCheckValidForDisplay({
        background_check: undefined,
        background_check_expiration: '2099-12-31',
      })
    ).toBe(true);
  });
});

describe('isSafeSportValidForDisplay', () => {
  it('requires expiration in the future', () => {
    expect(isSafeSportValidForDisplay({ safesport_expiration: '2020-01-01' })).toBe(false);
  });
});
