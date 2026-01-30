/**
 * Official school logos for coaches (athletes).
 * Logos are hosted on Vercel blob storage.
 */

const SCHOOL_LOGO_URLS: Record<string, string> = {
  'UNC': 'https://w8v0puzioqkz0xzh.public.blob.vercel-storage.com/college/Uigu95m8-1745952038636.png',
  'NC State': 'https://w8v0puzioqkz0xzh.public.blob.vercel-storage.com/college/fe5ixmej-1745958547259.png',
  'NCSU': 'https://w8v0puzioqkz0xzh.public.blob.vercel-storage.com/college/fe5ixmej-1745958547259.png',
  'North Carolina State': 'https://w8v0puzioqkz0xzh.public.blob.vercel-storage.com/college/fe5ixmej-1745958547259.png',
};

/**
 * Returns the URL to a school's logo image, or null if no logo is configured.
 */
export function getSchoolLogoUrl(school: string): string | null {
  if (!school || typeof school !== 'string') return null;
  const normalized = school.trim();
  return SCHOOL_LOGO_URLS[normalized] ?? null;
}

export function hasSchoolLogo(school: string): boolean {
  if (!school || typeof school !== 'string') return false;
  const normalized = school.trim();
  return normalized in SCHOOL_LOGO_URLS;
}
