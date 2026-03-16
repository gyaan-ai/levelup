'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { formatEST } from '@/lib/format-date';

type Thread = {
  parentId: string;
  athleteId: string;
  lastBody: string;
  lastAt: string;
  otherName: string;
  unread?: boolean;
};

type Filter = 'all' | 'unread';

export function InboxClient({ role }: { role: 'parent' | 'coach' }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const filteredThreads = useMemo(() => {
    if (filter === 'unread') return threads.filter((t) => t.unread);
    return threads;
  }, [threads, filter]);

  useEffect(() => {
    fetch('/api/coach-inquiries/threads')
      .then((r) => r.json())
      .then((data) => {
        if (data.threads && Array.isArray(data.threads)) setThreads(data.threads);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if (threads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">No conversations yet</p>
          <p className="text-sm text-muted-foreground">
            {role === 'parent'
              ? 'Go to a coach\'s profile and click "Message" to start a conversation.'
              : 'When a parent messages you, the conversation will appear here.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('unread')}
        >
          Unread
          {threads.some((t) => t.unread) && (
            <span className="ml-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-background/20 rounded-full">
              {threads.filter((t) => t.unread).length}
            </span>
          )}
        </Button>
      </div>
      <div className="space-y-2">
        {filteredThreads.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                {filter === 'unread' ? 'No unread conversations.' : 'No conversations yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredThreads.map((t) => {
            const link = `/inbox/thread/${t.parentId}/${t.athleteId}`;
            return (
              <Link key={`${t.parentId}-${t.athleteId}`} href={link}>
                <Card className={`hover:bg-muted/50 transition-colors ${t.unread ? 'border-l-4 border-l-primary' : ''}`}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate flex items-center gap-2">
                          {t.otherName}
                          {t.unread && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-accent" aria-hidden />
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{t.lastBody}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatEST(new Date(t.lastAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
