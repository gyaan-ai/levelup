import { z } from 'zod';

/**
 * Radix/shadcn Checkbox may leave value undefined until touched; plain `z.boolean()` fails and blocks submit.
 * Maps undefined / false / indeterminate → false; only strict true counts as attested.
 */
export const zOptionalCheckbox = z.preprocess((v: unknown) => v === true || v === 'true', z.boolean());

export function zRequiredAgreementCheckbox(message: string) {
  return z.preprocess((v: unknown) => v === true || v === 'true', z.boolean()).refine((v) => v === true, { message });
}
