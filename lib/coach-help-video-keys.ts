/** Stable key for the hero “home screen” tutorial on /coach-help (not tied to env URL). */
export const COACH_HELP_FEATURED_HOME_SCREEN_KEY = 'featured:home_screen' as const;

export function resourceVideoKey(resourceId: string): string {
  return `resource:${resourceId}`;
}

export function parseCoachHelpVideoKey(raw: string): { kind: 'featured' } | { kind: 'resource'; id: string } | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === COACH_HELP_FEATURED_HOME_SCREEN_KEY) return { kind: 'featured' };
  const m = /^resource:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(s);
  if (m) return { kind: 'resource', id: m[1] };
  return null;
}
