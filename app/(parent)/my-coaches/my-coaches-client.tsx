'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Heart, ExternalLink } from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';

type Coach = {
  id: string;
  firstName: string;
  lastName: string;
  school: string;
  photoUrl?: string;
};

type Follow = {
  coachId: string;
  followedAt: string;
  coach: Coach | null;
};

export function MyCoachesClient() {
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollows = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/coach-follows');
      const d = await r.json();
      if (d.follows) setFollows(d.follows);
    } catch {
      setFollows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollows();
  }, []);

  const unfollow = async (coachId: string) => {
    try {
      const r = await fetch(`/api/coach-follows?coachId=${encodeURIComponent(coachId)}`, {
        method: 'DELETE',
      });
      if (r.ok) setFollows((prev) => prev.filter((f) => f.coachId !== coachId));
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground text-center py-12">
        Loading…
      </div>
    );
  }

  if (follows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">You aren’t following any coaches yet.</p>
          <Button asChild variant="default">
            <Link href="/browse">Browse coaches</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {follows.map((f) => (
        <Card key={f.coachId}>
          <CardContent className="p-4 flex items-center gap-4">
            {f.coach?.photoUrl ? (
              <img
                src={f.coach.photoUrl}
                alt={`${f.coach.firstName} ${f.coach.lastName}`}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <User className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">
                {f.coach ? `${f.coach.firstName} ${f.coach.lastName}` : 'Coach'}
              </p>
              {f.coach?.school && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <SchoolLogo school={f.coach.school} size="sm" />
                  <span>{f.coach.school}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/athlete/${f.coachId}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Profile
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => unfollow(f.coachId)}
              >
                <Heart className="h-3.5 w-3.5 mr-1.5 fill-current" />
                Unfollow
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
