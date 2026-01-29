/**
 * Official school logos for coaches (athletes).
 * Logo files live in public/logos/schools/ — add unc.png, nc-state.png, etc.
 * See public/logos/schools/README.md for how to add or upload logos.
 */

const SCHOOL_LOGO_SLUGS: Record<string, string> = {
  'UNC': 'unc',
  'NC State': 'nc-state',
  'NCSU': 'nc-state',
  'North Carolina State': 'nc-state',
};

export function getSchoolLogoSlug(school: string): string | null {
  if (!school || typeof school !== 'string') return null;
  const normalized = school.trim();
  return SCHOOL_LOGO_SLUGS[normalized] ?? null;
}

/**
 * Returns the public path to a school's logo image, or null if no logo is configured.
 * Use this for img src; the file must exist in public/logos/schools/{slug}.png (or .svg).
 */
export function getSchoolLogoUrl(school: string, ext: 'png' | 'svg' = 'png'): string | null {
  const slug = getSchoolLogoSlug(school);
  if (!slug) return null;
  return `/logos/schools/${slug}.${ext}`;
}

export function hasSchoolLogo(school: string): boolean {
  return getSchoolLogoSlug(school) != null;
}
