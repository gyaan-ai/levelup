'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Star, Clock } from 'lucide-react';
import { BookingCard, type BookingSession } from './booking-card';

type TabId = 'upcoming' | 'past';

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
  
  // Separate past sessions into needing review vs already reviewed
  const needsReview = closed.filter(s => s.status === 'completed' && !s.hasReviewed);
  const reviewed = closed.filter(s => s.status === 'completed' && s.hasReviewed);
  const otherPast = closed.filter(s => s.status !== 'completed');

  return (
    <div className="min-h-screen">
      {/* Pill Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`min-h-[44px] px-5 py-2.5 text-sm font-medium rounded-full transition-all touch-manipulation ${
            activeTab === 'upcoming'
              ? 'bg-[#D4AF37] text-black'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`min-h-[44px] px-5 py-2.5 text-sm font-medium rounded-full transition-all touch-manipulation flex items-center gap-2 ${
            activeTab === 'past'
              ? 'bg-[#D4AF37] text-black'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          Past
          {needsReview.length > 0 && (
            <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold px-1.5 ${
              activeTab === 'past' ? 'bg-black/20 text-black' : 'bg-[#D4AF37] text-black'
            }`}>
              {needsReview.length}
            </span>
          )}
        </button>
      </div>

      {/* Upcoming Tab */}
      {activeTab === 'upcoming' && (
        <section className="space-y-6">
          {!hasUpcoming ? (
            <Card className="border-dashed border-zinc-800 bg-transparent">
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
                <p className="text-zinc-400 mb-1 text-lg">No upcoming sessions</p>
                <p className="text-zinc-500 text-sm mb-6">Book training to see your sessions here</p>
                <Link href="/training">
                  <Button className="bg-[#D4AF37] hover:bg-[#B8963C] text-black font-medium px-6">
                    Find Training
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {thisWeek.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-[#D4AF37]" />
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">This Week</h2>
                  </div>
                  <div className="space-y-3">
                    {thisWeek.map((s) => (
                      <BookingCard key={s.id} session={s} />
                    ))}
                  </div>
                </div>
              )}
              {thisMonth.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Later This Month</h2>
                  <div className="space-y-3">
                    {thisMonth.map((s) => (
                      <BookingCard key={s.id} session={s} />
                    ))}
                  </div>
                </div>
              )}
              {later.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Coming Up</h2>
                  <div className="space-y-3">
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

      {/* Past Tab */}
      {activeTab === 'past' && (
        <section className="space-y-6">
          {closed.length === 0 ? (
            <Card className="border-dashed border-zinc-800 bg-transparent">
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
                <p className="text-zinc-400">No past sessions yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Needs Review Section - Highlighted */}
              {needsReview.length > 0 && (
                <div className="rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="h-4 w-4 text-[#D4AF37] fill-current" />
                    <h2 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wide">
                      Leave Feedback ({needsReview.length})
                    </h2>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">
                    Help coaches improve by sharing your experience
                  </p>
                  <div className="space-y-3">
                    {needsReview.map((s) => (
                      <BookingCard key={s.id} session={s} isPast />
                    ))}
                  </div>
                </div>
              )}

              {/* Already Reviewed */}
              {reviewed.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Star className="h-4 w-4 text-zinc-500" />
                    Reviewed ({reviewed.length})
                  </h2>
                  <div className="space-y-3">
                    {reviewed.map((s) => (
                      <BookingCard key={s.id} session={s} isPast />
                    ))}
                  </div>
                </div>
              )}

              {/* Cancelled / No-show */}
              {otherPast.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                    Other ({otherPast.length})
                  </h2>
                  <div className="space-y-3">
                    {otherPast.map((s) => (
                      <BookingCard key={s.id} session={s} isPast />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
