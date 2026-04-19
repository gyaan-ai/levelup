/**
 * Official school logos for coaches (athletes).
 * Remote logos are hosted on Vercel blob storage; local logos live under /public/school-logos.
 */

const APP_STATE_LOGO = '/school-logos/app-state.png';

const SCHOOL_LOGO_URLS: Record<string, string> = {
  'UNC': 'https://w8v0puzioqkz0xzh.public.blob.vercel-storage.com/college/Uigu95m8-1745952038636.png',
  'NC State': 'https://w8v0puzioqkz0xzh.public.blob.vercel-storage.com/college/fe5ixmej-1745958547259.png',
  'NCSU': 'https://w8v0puzioqkz0xzh.public.blob.vercel-storage.com/college/fe5ixmej-1745958547259.png',
  'North Carolina State': 'https://w8v0puzioqkz0xzh.public.blob.vercel-storage.com/college/fe5ixmej-1745958547259.png',
  'App State': APP_STATE_LOGO,
  'Appalachian State': APP_STATE_LOGO,
  'Appalachian State University': APP_STATE_LOGO,
};

export type SchoolBadgeColors = {
  bg: string;
  text: string;
  /** Optional border (e.g. gold outline on black pill) */
  border?: string;
};

const SCHOOL_BADGE_COLORS: Record<string, SchoolBadgeColors> = {
  'UNC': { bg: 'bg-blue-600', text: 'text-white' },
  'NC State': { bg: 'bg-red-600', text: 'text-white' },
  'NCSU': { bg: 'bg-red-600', text: 'text-white' },
  'North Carolina State': { bg: 'bg-red-600', text: 'text-white' },
  'App State': {
    bg: 'bg-black',
    text: 'text-[#FFCD00]',
    border: 'border border-[#FFCD00]/60',
  },
  'Appalachian State': {
    bg: 'bg-black',
    text: 'text-[#FFCD00]',
    border: 'border border-[#FFCD00]/60',
  },
  'Appalachian State University': {
    bg: 'bg-black',
    text: 'text-[#FFCD00]',
    border: 'border border-[#FFCD00]/60',
  },
};

const DEFAULT_BADGE: SchoolBadgeColors = { bg: 'bg-gray-600', text: 'text-white' };

/**
 * Tailwind classes for school name pills (badges).
 */
export function getSchoolBadgeColors(school: string): SchoolBadgeColors {
  if (!school || typeof school !== 'string') return DEFAULT_BADGE;
  const normalized = school.trim();
  return SCHOOL_BADGE_COLORS[normalized] ?? DEFAULT_BADGE;
}

/** Join badge color classes for use on `<Badge />` etc. */
export function schoolBadgeClassName(colors: SchoolBadgeColors, extra?: string): string {
  return [colors.bg, colors.text, colors.border, extra].filter(Boolean).join(' ');
}

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
