'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';

interface MessageInputProps {
  workspaceId: string;
  onMessageSent?: () => void;
}

export function MessageInput({ workspaceId, onMessageSent }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send message');
      }

      setMessage('');
      onMessageSent?.();
    } catch (err) {
      console.error('Failed to send message:', err);
      alert(err instanceof Error ? err.message : 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex gap-2 items-end min-h-[44px]">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        className="min-h-[44px] max-h-32 resize-none text-[15px] py-3"
        disabled={sending}
        rows={1}
      />
      <Button
        onClick={handleSend}
        disabled={!message.trim() || sending}
        size="icon"
        className="h-11 w-11 shrink-0 min-w-[44px] min-h-[44px]"
        aria-label="Send message"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
