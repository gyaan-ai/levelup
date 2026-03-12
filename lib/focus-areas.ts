/**
 * Training focus areas for small group / group sessions.
 * Used when creating sessions and displayed on session cards.
 */
export const SESSION_FOCUS_AREAS = [
  'Takedowns',
  'Single leg set-ups',
  'Double legs',
  'Escapes',
  'Leg riding',
  'Top control',
  'Bottom position',
  'Neutral',
  'Finishing',
  'Hand fighting',
  'Other',
] as const;

export type SessionFocusArea = (typeof SESSION_FOCUS_AREAS)[number];
