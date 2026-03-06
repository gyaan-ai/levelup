'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, List, LayoutGrid, CalendarDays, MessageCircle } from 'lucide-react';
import { UpcomingSessionActions } from './upcoming-session-actions';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

export type CoachSession = {
  id: string;
  scheduled_datetime: string;
  total_price?: number;
  session_type?: string;
  status: string;
  facilities?: { name?: string } | { name?: string }[] | null;
  session_participants?: Array<{
    youth_wrestler_id?: string | null;
    youth_wrestlers?: { id: string; first_name?: string; last_name?: string } | { id: string; first_name?: string; last_name?: string }[] | null;
  }> | null;
};

function facilityName(s: CoachSession): string {
  const f = s.facilities;
  if (!f || typeof f !== 'object') return '—';
  const arr = Array.isArray(f) ? f : [f];
  const first = arr[0] as { name?: string } | null;
  return first?.name ?? '—';
}

function wrestlerNames(s: CoachSession): string[] {
  const parts = s.session_participants ?? [];
  return parts
    .map((p) => {
      const yw = p.youth_wrestlers;
      const o = Array.isArray(yw) ? yw[0] : yw;
      return o && (o.first_name || o.last_name) ? [o.first_name, o.last_name].filter(Boolean).join(' ') : null;
    })
    .filter((n): n is string => Boolean(n));
}

type ViewMode = 'list' | 'table' | 'calendar';

export function CoachScheduleCard({
  upcomingSessions,
  pastSessions,
}: {
  upcomingSessions: CoachSession[];
  pastSessions: CoachSession[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const allSessions = useMemo(
    () => [...upcomingSessions, ...pastSessions].sort(
      (a, b) => new Date(a.scheduled_datetime).getTime() - new Date(b.scheduled_datetime).getTime()
    ),
    [upcomingSessions, pastSessions]
  );

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CoachSession[]>();
    for (const s of allSessions) {
      const key = format(new Date(s.scheduled_datetime), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [allSessions]);

  const calendarDaysWithSessions = useMemo(() => {
    return Array.from(sessionsByDate.keys()).map((d) => new Date(d + 'T12:00:00'));
  }, [sessionsByDate]);

  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const sessionsInMonth = allSessions.filter(
    (s) => {
      const d = new Date(s.scheduled_datetime);
      return d >= monthStart && d <= monthEnd;
    }
  );

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Schedule & Bookings</CardTitle>
          <CardDescription>Upcoming and past sessions</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Table
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Calendar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {viewMode === 'list' && (
          <>
            <div>
              <h3 className="text-sm font-semibold mb-3">Upcoming</h3>
              {upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {format(new Date(session.scheduled_datetime), 'EEEE, MMMM d, yyyy')}
                        </p>
                        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
                          {format(new Date(session.scheduled_datetime), 'h:mm a')}
                          {' • '}
                          {facilityName(session)}
                          {wrestlerNames(session).length > 0 && (
                            <>
                              <span> • </span>
                              <span>with {wrestlerNames(session).join(', ')}</span>
                            </>
                          )}
                          {session.status === 'pending_payment' && (
                            <>
                              <span> • </span>
                              <Badge variant="secondary" className="text-xs">Pending payment</Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="font-medium">${Number(session.total_price || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{session.session_type || '—'}</p>
                        <UpcomingSessionActions
                          sessionId={session.id}
                          scheduledDatetime={session.scheduled_datetime}
                          totalPrice={Number(session.total_price || 0)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border rounded-lg bg-muted/30">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No upcoming sessions</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3">Past</h3>
              {pastSessions.length > 0 ? (
                <div className="space-y-3">
                  {pastSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border rounded-lg bg-muted/20"
                    >
                      <div>
                        <p className="font-medium">
                          {format(new Date(session.scheduled_datetime), 'EEE, MMM d, yyyy')}
                        </p>
                        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
                          {format(new Date(session.scheduled_datetime), 'h:mm a')}
                          {' • '}
                          {facilityName(session)}
                          {wrestlerNames(session).length > 0 && (
                            <>
                              <span> • </span>
                              <span>with {wrestlerNames(session).join(', ')}</span>
                            </>
                          )}
                          {' • '}
                          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                            {session.status === 'completed' ? 'Completed' : session.status === 'cancelled' ? 'Cancelled' : 'No-show'}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="font-medium">${Number(session.total_price || 0).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{session.session_type || '—'}</p>
                        <Link href={`/messages/${session.id}`}>
                          <Button variant="ghost" size="sm">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">No past sessions yet.</p>
              )}
            </div>
          </>
        )}

        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Time</th>
                  <th className="text-left py-2 px-2">Youth wrestler(s)</th>
                  <th className="text-left py-2 px-2">Facility</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allSessions.map((session) => {
                  const isUpcoming = ['scheduled', 'pending_payment'].includes(session.status) && new Date(session.scheduled_datetime) > new Date();
                  return (
                    <tr key={session.id} className="border-b last:border-0">
                      <td className="py-2 px-2">{format(new Date(session.scheduled_datetime), 'MMM d, yyyy')}</td>
                      <td className="py-2 px-2">{format(new Date(session.scheduled_datetime), 'h:mm a')}</td>
                      <td className="py-2 px-2">{wrestlerNames(session).length > 0 ? wrestlerNames(session).join(', ') : '—'}</td>
                      <td className="py-2 px-2">{facilityName(session)}</td>
                      <td className="py-2 px-2">{session.session_type || '—'}</td>
                      <td className="py-2 px-2 text-right">${Number(session.total_price || 0).toFixed(2)}</td>
                      <td className="py-2 px-2">
                        <Badge variant={session.status === 'completed' ? 'default' : session.status === 'cancelled' ? 'secondary' : 'outline'}>
                          {session.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right">
                        {isUpcoming ? (
                          <UpcomingSessionActions
                            sessionId={session.id}
                            scheduledDatetime={session.scheduled_datetime}
                            totalPrice={Number(session.total_price || 0)}
                          />
                        ) : (
                          <Link href={`/messages/${session.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 text-xs">Message</Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {allSessions.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No sessions.</p>
            )}
          </div>
        )}

        {viewMode === 'calendar' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex flex-col items-center shrink-0 w-fit">
              <div className="flex items-center gap-2 mb-2">
                <Button variant="outline" size="icon" onClick={() => setCalendarMonth((m) => subMonths(m, 1))}>←</Button>
                <span className="font-medium min-w-[140px] text-center">{format(calendarMonth, 'MMMM yyyy')}</span>
                <Button variant="outline" size="icon" onClick={() => setCalendarMonth((m) => addMonths(m, 1))}>→</Button>
              </div>
              <Calendar
                mode="single"
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                selected={undefined}
                modifiers={{ hasSession: calendarDaysWithSessions }}
                modifiersClassNames={{ hasSession: 'bg-accent/20 font-semibold' }}
                className="rounded-md border w-fit"
              />
            </div>
            <div className="min-w-0 flex-1 lg:min-w-[260px] lg:max-w-[360px]">
              <h3 className="text-sm font-semibold mb-2 break-words">Sessions in {format(calendarMonth, 'MMMM yyyy')}</h3>
              {sessionsInMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground break-words">No sessions this month.</p>
              ) : (
                <ul className="space-y-2">
                  {sessionsInMonth.map((session) => (
                    <li key={session.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm break-words">
                          {format(new Date(session.scheduled_datetime), 'EEE, MMM d')} at {format(new Date(session.scheduled_datetime), 'h:mm a')}
                        </p>
                        <p className="text-xs text-muted-foreground break-words">
                          {facilityName(session)}
                          {wrestlerNames(session).length > 0 && ` • with ${wrestlerNames(session).join(', ')}`}
                          {' • '}${Number(session.total_price || 0).toFixed(2)}
                        </p>
                      </div>
                      {['scheduled', 'pending_payment'].includes(session.status) && new Date(session.scheduled_datetime) > new Date() ? (
                        <div className="flex gap-1">
                          <Link href={`/sessions/${session.id}/reschedule`}>
                            <Button variant="outline" size="sm">Reschedule</Button>
                          </Link>
                          <UpcomingSessionActions
                            sessionId={session.id}
                            scheduledDatetime={session.scheduled_datetime}
                            totalPrice={Number(session.total_price || 0)}
                          />
                        </div>
                      ) : (
                        <Link href={`/messages/${session.id}`}>
                          <Button variant="ghost" size="sm">Message</Button>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
