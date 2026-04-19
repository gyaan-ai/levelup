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
  /** Carolina blue (digital) + navy text for contrast */
  'UNC': {
    bg: 'bg-[#4B9CD3]',
    text: 'text-[#13294B]',
    border: 'border border-[#13294B]/20',
  },
  /** NC State red */
  'NC State': {
    bg: 'bg-[#CC0000]',
    text: 'text-white',
    border: 'border border-[#990000]/40',
  },
  'NCSU': {
    bg: 'bg-[#CC0000]',
    text: 'text-white',
    border: 'border border-[#990000]/40',
  },
  'North Carolina State': {
    bg: 'bg-[#CC0000]',
    text: 'text-white',
    border: 'border border-[#990000]/40',
  },
  /** App State gold/yellow pill, black type */
  'App State': {
    bg: 'bg-[#FFCD00]',
    text: 'text-black',
    border: 'border border-black/15',
  },
  'Appalachian State': {
    bg: 'bg-[#FFCD00]',
    text: 'text-black',
    border: 'border border-black/15',
  },
  'Appalachian State University': {
    bg: 'bg-[#FFCD00]',
    text: 'text-black',
    border: 'border border-black/15',
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
