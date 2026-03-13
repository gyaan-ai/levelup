/**
 * Generate an ICS (iCalendar) string for a session so coaches/parents can add to Apple Calendar, Google, etc.
 */

function formatICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export interface SessionCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
}

/** Default duration in minutes if end time unknown */
const DEFAULT_DURATION_MINUTES = 60;

export function buildSessionICS(event: SessionCalendarEvent, durationMinutes = DEFAULT_DURATION_MINUTES): string {
  const start = event.start;
  const end = event.end ?? new Date(start.getTime() + durationMinutes * 60 * 1000);
  const uid = `session-${event.id}@guild`;
  const title = escapeICS(event.title);
  const loc = event.location ? escapeICS(event.location) : '';
  const desc = event.description ? escapeICS(event.description) : '';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Guild//Session//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:${title}`,
    ...(loc ? [`LOCATION:${loc}`] : []),
    ...(desc ? [`DESCRIPTION:${desc}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

/** Trigger download of an ICS file in the browser */
export function downloadICS(icsContent: string, filename = 'session.ics'): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
