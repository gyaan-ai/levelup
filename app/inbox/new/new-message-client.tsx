'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Users, Loader2 } from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';

type Coach = { id: string; firstName: string; lastName: string; school: string; photoUrl?: string };
type Follow = { coachId: string; coach: Coach | null };

export function NewMessageClient({
  currentUserId,
  role,
}: {
  currentUserId: string;
  role: 'parent' | 'athlete' | 'admin';
}) {
  const router = useRouter();
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);
  const isParentView = role === 'parent' || role === 'admin';

  useEffect(() => {
    if (!isParentView) {
      setLoading(false);
      return;
    }
    fetch('/api/coach-follows')
      .then((r) => r.json())
      .then((d) => {
        if (d.follows) setFollows(d.follows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isParentView]);

  const handleCoachClick = (coachId: string) => {
    router.push(`/inbox/thread/${currentUserId}/${coachId}`);
  };

  if (!isParentView) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-muted-foreground">
            Start a group to message parents and wrestlers together, or use existing conversations in the sidebar.
          </p>
          <Link href="/inbox/groups/new">
            <Button className="gap-2">
              <Users className="h-4 w-4" />
              Create a group
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const coaches = follows.filter((f) => f.coach).map((f) => f.coach!);

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Message a coach
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Choose a coach you follow to start or continue a conversation. Share links, ask questions, or coordinate sessions.
          </p>
          {coaches.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">
              You don&apos;t follow any coaches yet. Browse coaches and follow them to message from here.
            </p>
          ) : (
            <ul className="space-y-2">
              {coaches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleCoachClick(c.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 text-left transition-colors"
                  >
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <MessageCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {c.firstName} {c.lastName}
                      </p>
                      {c.school && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <SchoolLogo school={c.school} size="sm" />
                          {c.school}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/browse">Browse all coaches</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        To share a session link with another wrestler or parent, use the &quot;Share link&quot; button on that booking, or paste the link in a group or message.
      </p>
    </div>
  );
}
