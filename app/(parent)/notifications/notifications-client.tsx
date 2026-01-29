'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface NotificationsClientProps {
  initialNotifications: NotificationItem[];
}

export function NotificationsClient({ initialNotifications }: NotificationsClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications);

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No notifications yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => {
        const link = typeof n.data?.link === 'string' ? n.data.link : null;
        return (
          <Card key={n.id} className={n.read_at ? 'opacity-75' : ''}>
            <CardContent className="py-4">
              <p className="font-medium">{n.title}</p>
              {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
              <p className="text-xs text-muted-foreground mt-2">{format(new Date(n.created_at), 'MMM d, yyyy h:mm a')}</p>
              {link && (
                <Link href={link} className="mt-3 inline-block">
                  <Button variant="outline" size="sm">View</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
