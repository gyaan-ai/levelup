'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { format } from 'date-fns';

type Notification = {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell({
  count,
  onRefresh,
}: {
  count: number;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/notifications')
      .then((r) => r.ok ? r.json() : { notifications: [] })
      .then((data) => {
        setList(data?.notifications ?? []);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  const markAllRead = async () => {
    const res = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    if (res.ok) {
      setList((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      onRefresh();
    }
  };

  const markOneRead = async (id: string) => {
    const res = await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (res.ok) {
      setList((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
      onRefresh();
    }
  };

  const link = (n: Notification) => (typeof n.data?.link === 'string' ? n.data.link : null);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center p-1.5 text-white hover:text-accent transition-colors font-medium rounded hover:bg-white/10"
        aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-accent text-black rounded-full -translate-y-0.5 translate-x-0.5">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-[320px] max-h-[400px] overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-lg z-50 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            {list.some((n) => !n.read_at) && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-[320px]">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : list.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="divide-y">
                {list.slice(0, 15).map((n) => {
                  const href = link(n);
                  return (
                    <li key={n.id}>
                      {href ? (
                        <Link
                          href={href}
                          onClick={() => {
                            markOneRead(n.id);
                            setOpen(false);
                          }}
                          className={`block px-3 py-2 hover:bg-muted/50 ${!n.read_at ? 'bg-muted/30' : ''}`}
                        >
                          <p className="font-medium text-sm">{n.title}</p>
                          {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), 'MMM d, h:mm a')}</p>
                        </Link>
                      ) : (
                        <div className={`px-3 py-2 ${!n.read_at ? 'bg-muted/30' : ''}`}>
                          <p className="font-medium text-sm">{n.title}</p>
                          {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), 'MMM d, h:mm a')}</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t px-3 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm text-accent hover:underline font-medium"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
