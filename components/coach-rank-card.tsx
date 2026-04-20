'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Star, Flame, Medal } from 'lucide-react';

type CoachStats = {
  id: string;
  name: string;
  sessionCount: number;
  averageRating: number | null;
  reviewCount: number;
  thisMonthSessions: number;
  sessionRank: number;
  ratingRank: number | null;
  isOnFire: boolean;
};

type LeaderboardData = {
  leaderboard: CoachStats[];
  totalCoaches: number;
};

type Props = {
  coachId: string;
  /** When set, show top N coaches by completed sessions under your rank */
  topSessionsListSize?: number;
};

export function CoachRankCard({ coachId, topSessionsListSize }: Props) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/coach/leaderboard')
      .then(res => res.json())
      .then((d: LeaderboardData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="bg-muted/30 animate-pulse">
        <CardContent className="p-4 h-20" />
      </Card>
    );
  }

  if (!data) return null;

  const myStats = data.leaderboard.find(c => c.id === coachId);
  const totalCoaches = data.totalCoaches;

  const topBySessions = topSessionsListSize
    ? [...data.leaderboard].sort((a, b) => b.sessionCount - a.sessionCount).slice(0, topSessionsListSize)
    : [];

  if (!myStats && !topSessionsListSize) return null;

  const sessionRank = myStats?.sessionRank ?? null;
  const ratingRank = myStats?.ratingRank ?? null;
  const sessionCount = myStats?.sessionCount ?? 0;
  const isOnFire = myStats?.isOnFire ?? false;
  const averageRating = myStats?.averageRating ?? null;
  const reviewCount = myStats?.reviewCount ?? 0;

  // Determine badges
  const badges: { icon: React.ReactNode; label: string; color: string }[] = [];
  
  if (sessionRank === 1 && sessionCount > 0) {
    badges.push({ 
      icon: <Trophy className="h-4 w-4" />, 
      label: 'Most Sessions', 
      color: 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30' 
    });
  }
  
  if (ratingRank === 1 && reviewCount > 0) {
    badges.push({ 
      icon: <Star className="h-4 w-4" />, 
      label: 'Top Rated', 
      color: 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30' 
    });
  }
  
  if (isOnFire) {
    badges.push({ 
      icon: <Flame className="h-4 w-4" />, 
      label: 'On Fire', 
      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
    });
  }

  return (
    <Card className="border-accent/30 bg-gradient-to-r from-primary to-primary/80">
      <CardContent className="p-4">
        {myStats ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                  <Medal className="h-6 w-6 text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your rank</p>
                  <p className="text-2xl font-bold text-foreground">
                    #{myStats.sessionRank}{' '}
                    <span className="text-sm font-normal text-muted-foreground">of {totalCoaches}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{sessionCount} sessions completed</p>
                </div>
              </div>

              {badges.length > 0 && (
                <div className="flex flex-col gap-1.5 sm:items-end">
                  {badges.map((badge, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${badge.color}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {averageRating && reviewCount > 0 && (
              <div className="mt-3 pt-3 border-t border-accent/20 flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-[#D4AF37] fill-[#D4AF37]" />
                  <span className="font-medium">{averageRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({reviewCount} reviews)</span>
                </div>
                {ratingRank && (
                  <span className="text-muted-foreground">
                    #{ratingRank} in ratings
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your profile isn&apos;t on the public leaderboard yet (inactive or new). Top coaches by completed sessions are
            below.
          </p>
        )}

        {topBySessions.length > 0 && (
          <div className={myStats ? 'mt-4 pt-4 border-t border-accent/20' : ''}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Top coaches · completed sessions
            </p>
            <ul className="space-y-2">
              {topBySessions.map((c, idx) => (
                <li
                  key={c.id}
                  className={`flex items-center justify-between gap-2 text-sm ${c.id === coachId ? 'font-semibold text-[#D4AF37]' : ''}`}
                >
                  <span className="min-w-0 truncate">
                    <span className="tabular-nums text-muted-foreground mr-2">{idx + 1}.</span>
                    {c.name}
                    {c.id === coachId ? <span className="sr-only"> (you)</span> : null}
                  </span>
                  <span className="tabular-nums shrink-0 text-muted-foreground">{c.sessionCount}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
