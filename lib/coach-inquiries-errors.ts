/**
 * User-facing message when coach_inquiries (DM) table is missing or DB schema issue.
 * If users see this: run migrations 20240137000000_coach_inquiries.sql and
 * 20240138000000_coach_inquiry_thread_read.sql on the Supabase project.
 */
export const DM_UNAVAILABLE_MESSAGE =
  'Direct messaging is not available. Please try again later or contact support.';

/** Detect Supabase/PostgREST error for missing table or schema cache */
export function isMissingTableError(error: { message?: string } | null): boolean {
  if (!error?.message) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes('schema cache') ||
    m.includes('could not find the table') ||
    /relation\s+["']?[\w.]*["']?\s+does not exist/.test(m)
  );
}
