'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { BookingCard, type BookingSession } from './booking-card';

type TabId = 'upcoming' | 'past';

export function BookingsTabsClient({
  upcoming,
  past,
}: {
  upcoming: BookingSession[];
  past: BookingSession[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>('upcoming');

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
          onClick={() => setActiveTab('past')}
          className={`min-h-[44px] px-4 py-2 text-sm font-medium border-b-2 shrink-0 touch-manipulation ${
            activeTab === 'past'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Past
        </button>
      </div>

      {activeTab === 'upcoming' && (
        <section>
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming sessions. <Link href="/training" className="text-accent underline">Find training</Link> to book.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcoming.map((s) => (
                <BookingCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'past' && (
        <section>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No past sessions yet.</p>
          ) : (
            <div className="space-y-4">
              {past.map((s) => (
                <BookingCard key={s.id} session={s} isPast />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
