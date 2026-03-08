'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send } from 'lucide-react';

type MessageRow = {
  id: string;
  parent_id: string;
  athlete_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export function InquiryThread({
  parentId,
  athleteId,
  currentUserId,
}: {
  parentId: string;
  athleteId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [otherName, setOtherName] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThread = async () => {
    setError(null);
    try {
      const r = await fetch(
        `/api/coach-inquiries?parentId=${encodeURIComponent(parentId)}&athleteId=${encodeURIComponent(athleteId)}`
      );
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        if (Array.isArray(data.messages)) setMessages(data.messages);
        if (data.otherParty?.name) setOtherName(data.otherParty.name);
      } else {
        setError(data.error || 'Couldn’t load this conversation.');
      }
    } catch {
      setError('Couldn’t load this conversation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
  }, [parentId, athleteId]);

  useEffect(() => {
    fetch('/api/coach-inquiries/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, athleteId }),
    }).catch(() => {});
  }, [parentId, athleteId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch('/api/coach-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, athleteId, body: text }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to send');
      setDraft('');
      await fetchThread();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/inbox"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Community
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversation with {otherName || '…'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-3 min-h-[200px] max-h-[400px] overflow-y-auto rounded-lg border bg-muted/20 p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet. Send one to start the conversation.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.sender_id === currentUserId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted border'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={`text-xs mt-1 ${
                        m.sender_id === currentUserId ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(m.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              className="resize-none"
            />
            <Button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              size="icon"
              className="shrink-0 h-auto"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
