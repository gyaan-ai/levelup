'use client';

import { useEffect, useRef } from 'react';
import { useWorkspaceMessages } from '@/lib/hooks/use-workspace-messages';
import { formatDistanceToNow } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
  workspaceId: string;
  currentUserId: string;
}

export function MessageList({ workspaceId, currentUserId }: MessageListProps) {
  const { messages, loading, error } = useWorkspaceMessages(workspaceId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]" role="status" aria-label="Loading messages">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-destructive" role="alert">
        Failed to load messages
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-muted-foreground text-center px-4">
        <p className="text-lg font-medium">No messages yet</p>
        <p className="text-sm mt-2">Start a conversation!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="log" aria-label="Chat messages">
      {messages.map((message) => {
        const isOwn = message.author_id === currentUserId;
        const isSystem = message.message_type === 'system';

        if (isSystem) {
          return (
            <div key={message.id} className="flex justify-center">
              <div className="bg-muted text-muted-foreground text-sm px-4 py-2 rounded-full max-w-[85%] sm:max-w-md text-center">
                {message.content}
              </div>
            </div>
          );
        }

        return (
          <div
            key={message.id}
            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] sm:max-w-md min-w-0 ${
                isOwn
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                  : 'bg-muted text-foreground rounded-2xl rounded-tl-sm'
              } px-4 py-2.5`}
            >
              {!isOwn && message.author && (
                <p className="text-xs font-semibold mb-1 opacity-80">
                  {message.author.name}
                </p>
              )}
              <p className="text-[15px] whitespace-pre-wrap break-words">
                {message.content}
              </p>
              <p
                className={`text-xs mt-1 ${
                  isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                }`}
              >
                {formatDistanceToNow(new Date(message.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} aria-hidden="true" />
    </div>
  );
}
