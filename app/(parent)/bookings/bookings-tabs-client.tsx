'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { BookingCard, type BookingSession } from './booking-card';

type TabId = 'upcoming' | 'closed';

export function BookingsTabsClient({
  thisWeek,
  thisMonth,
  later,
  closed,
}: {
  thisWeek: BookingSession[];
  thisMonth: BookingSession[];
  later: BookingSession[];
  closed: BookingSession[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>('upcoming');
  const hasUpcoming = thisWeek.length > 0 || thisMonth.length > 0 || later.length > 0;

  return (
    <>
      <div className="flex gap-2 border-b border-border mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`min-h-[44px] px-4 py-2 text-sm font-medium border-b-2 shrink-0 touch-manipulation ${
            activeTab === 'upcoming'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('closed')}
          className={`min-h-[44px] px-4 py-2 text-sm font-medium border-b-2 shrink-0 touch-manipulation ${
            activeTab === 'closed'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          aria-label={`Past sessions and leave feedback (${closed.length})`}
        >
          Past ({closed.length})
        </button>
      </div>

      {activeTab === 'upcoming' && (
        <section className="space-y-8">
          {!hasUpcoming ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming sessions. <Link href="/training" className="text-accent underline">Find training</Link> to book.
              </CardContent>
            </Card>
          ) : (
            <>
              {thisWeek.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">This week</h2>
                  <div className="space-y-4">
                    {thisWeek.map((s) => (
                      <BookingCard key={s.id} session={s} />
                    ))}
                  </div>
                </div>
              )}
              {thisMonth.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Later this month</h2>
                  <div className="space-y-4">
                    {thisMonth.map((s) => (
                      <BookingCard key={s.id} session={s} />
                    ))}
                  </div>
                </div>
              )}
              {later.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Later</h2>
                  <div className="space-y-4">
                    {later.map((s) => (
                      <BookingCard key={s.id} session={s} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'closed' && (
        <section>
          {closed.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No past sessions.</p>
          ) : (
            <div className="space-y-4">
              {closed.map((s) => (
                <BookingCard key={s.id} session={s} isPast />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
