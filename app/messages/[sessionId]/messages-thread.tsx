'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';

export type MessageRow = {
  id: string;
  session_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

interface MessagesThreadProps {
  sessionId: string;
  initialMessages: MessageRow[];
  currentUserId: string;
  heading: string;
  backHref: string;
  backLabel: string;
}

export function MessagesThread({
  sessionId,
  initialMessages,
  currentUserId,
  heading,
  backHref,
  backLabel,
}: MessagesThreadProps) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const fetchMessages = async () => {
    try {
      const r = await fetch(`/api/booking-messages?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await r.json();
      if (r.ok && Array.isArray(data.messages)) setMessages(data.messages);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    let ok = true;
    fetch(`/api/booking-messages?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (ok && data.messages && Array.isArray(data.messages)) setMessages(data.messages);
      })
      .catch(() => {});
    return () => { ok = false; };
  }, [sessionId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const r = await fetch('/api/booking-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, body: text }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to send');
      setDraft('');
      await fetchMessages();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 min-h-[200px] max-h-[400px] overflow-y-auto rounded-lg border bg-muted/20 p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No messages yet. Send one to start the conversation.
              </p>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        isMe
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted border'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
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
                );
              })
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
