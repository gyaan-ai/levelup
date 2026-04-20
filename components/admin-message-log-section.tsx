'use client';

import { useEffect, useState } from 'react';
import { Bell, Loader2, MessageSquare, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function AdminMessageLogSection() {
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      created_at: string;
      channel: 'sms' | 'notification';
      recipient_phone?: string;
      recipient_label?: string;
      message_type: string;
      title?: string;
      body?: string;
      status: string;
      error_detail?: string;
      session_id?: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sms' | 'notification'>('all');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const channelParam = filter === 'all' ? '' : `&channel=${filter}`;
    fetch(`/api/admin/message-log?limit=200${channelParam}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        setTotal(data.total || 0);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <MessageSquare className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">SMS &amp; in-app alerts</h2>
            <p className="text-sm text-muted-foreground">{total} total log entries (filtered list below)</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
            All
          </Button>
          <Button variant={filter === 'sms' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('sms')}>
            <Phone className="h-3.5 w-3.5 mr-1" />
            SMS
          </Button>
          <Button
            variant={filter === 'notification' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('notification')}
          >
            <Bell className="h-3.5 w-3.5 mr-1" />
            Alerts
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold tabular-nums">{messages.filter((m) => m.channel === 'sms').length}</p>
              <p className="text-xs text-muted-foreground">SMS rows (this page)</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {messages.filter((m) => m.channel === 'notification').length}
              </p>
              <p className="text-xs text-muted-foreground">Alert rows (this page)</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Channel
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Message
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Session
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : messages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No messages logged yet
                    </td>
                  </tr>
                ) : (
                  messages.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30">
                      <td className="py-3 px-4">
                        {m.channel === 'sms' ? (
                          <Badge variant="outline" className="border-emerald-600 bg-emerald-600/20 text-emerald-400">
                            <Phone className="h-3 w-3 mr-1" />
                            SMS
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-blue-600 bg-blue-600/20 text-blue-400">
                            <Bell className="h-3 w-3 mr-1" />
                            Alert
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">{m.recipient_label || m.recipient_phone || 'Unknown'}</div>
                        {m.recipient_phone && m.recipient_label ? (
                          <div className="text-xs text-muted-foreground">{m.recipient_phone}</div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 max-w-[220px] sm:max-w-xs">
                        {m.title ? <div className="font-medium text-sm truncate">{m.title}</div> : null}
                        <div className="text-sm text-muted-foreground line-clamp-2">{m.body || '—'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">{m.message_type}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground font-mono max-w-[100px] truncate">
                        {m.session_id ? m.session_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {m.status === 'sent' ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-600 bg-emerald-600/20 text-emerald-400"
                          >
                            Sent
                          </Badge>
                        ) : m.status === 'failed' ? (
                          <Badge
                            variant="outline"
                            className="border-red-600 bg-red-600/20 text-red-400"
                            title={m.error_detail}
                          >
                            Failed
                          </Badge>
                        ) : (
                          <Badge variant="outline">{m.status}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
