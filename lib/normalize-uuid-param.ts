/**
 * Normalize ids from JSON / UI (trim, strip BOM/invisibles, braces, optional 32-hex form).
 */
export function normalizeUuidParam(value: unknown): string | null {
  if (value == null) return null;
  let s = String(value).trim();
  s = s.replace(/^\{|\}$/g, '').replace(/^urn:uuid:/i, '').trim();
  s = s.replace(/[\u200b-\u200f\ufeff\u00a0\u202f]/g, '');
  if (!s) return null;
  s = s.toLowerCase();
  const hyphenated =
    /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/.exec(s);
  if (hyphenated) {
    return `${hyphenated[1]}-${hyphenated[2]}-${hyphenated[3]}-${hyphenated[4]}-${hyphenated[5]}`;
  }
  const compact = s.replace(/-/g, '');
  if (/^[0-9a-f]{32}$/.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
  }
  return null;
}
