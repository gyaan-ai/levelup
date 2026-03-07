'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceMessages } from '@/lib/hooks/use-workspace-messages';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Pencil, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const EMOJI_QUICK = ['👍', '❤️', '😂', '🔥', '💪', '✅', '👀', '🙌'];

interface MessageListProps {
  workspaceId: string;
  currentUserId: string;
}

export function MessageList({ workspaceId, currentUserId }: MessageListProps) {
  const {
    messages,
    loading,
    error,
    updateMessageContent,
    updateMessageReactions,
  } = useWorkspaceMessages(workspaceId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [showReactionMessageId, setShowReactionMessageId] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startEdit = useCallback((message: { id: string; content: string }) => {
    setEditingId(message.id);
    setEditContent(message.content);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/messages/${editingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editContent.trim() }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json();
      const updated_at = data.message?.updated_at ?? new Date().toISOString();
      updateMessageContent(editingId, editContent.trim(), updated_at);
      setEditingId(null);
      setEditContent('');
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingEdit(false);
    }
  }, [workspaceId, editingId, editContent, savingEdit, updateMessageContent]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg?.reactions) return;
      const current = msg.reactions.find((r) => r.emoji === emoji);
      const me = current?.userIds.includes(currentUserId);
      try {
        if (me) {
          const res = await fetch(
            `/api/workspaces/${workspaceId}/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
            { method: 'DELETE' }
          );
          if (!res.ok) throw new Error('Failed to remove reaction');
          const next = msg.reactions
            .map((r) =>
              r.emoji === emoji
                ? { ...r, userIds: r.userIds.filter((id) => id !== currentUserId) }
                : r
            )
            .filter((r) => r.userIds.length > 0);
          updateMessageReactions(messageId, next);
        } else {
          const res = await fetch(
            `/api/workspaces/${workspaceId}/messages/${messageId}/reactions`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ emoji }),
            }
          );
          if (!res.ok) throw new Error('Failed to add reaction');
          const next = msg.reactions.some((r) => r.emoji === emoji)
            ? msg.reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, userIds: [...r.userIds, currentUserId] }
                  : r
              )
            : [...msg.reactions, { emoji, userIds: [currentUserId] }];
          updateMessageReactions(messageId, next);
        }
        setShowReactionMessageId(null);
      } catch (e) {
        console.error(e);
      }
    },
    [
      workspaceId,
      currentUserId,
      messages,
      updateMessageReactions,
    ]
  );

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
        const isEdited = message.updated_at && message.updated_at !== message.created_at;

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
          <div key={message.id} className="group flex flex-col gap-0.5">
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-start gap-2`}>
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
                {editingId === message.id ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      className="min-w-[180px] resize-none bg-background/20 text-foreground"
                      disabled={savingEdit}
                    />
                    <div className="flex gap-1">
                      <Button size="sm" onClick={saveEdit} disabled={savingEdit || !editContent.trim()}>
                        {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingId(null); setEditContent(''); }}
                        disabled={savingEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
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
                      {isEdited && ' · edited'}
                    </p>
                  </>
                )}
              </div>
              {editingId !== message.id && isOwn && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 h-8 w-8 shrink-0"
                  onClick={() => startEdit(message)}
                  title="Edit message"
                  aria-label="Edit message"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {editingId !== message.id && message.reactions && (
              <div className={`flex flex-wrap gap-1 ${isOwn ? 'justify-end mr-10' : 'ml-1'}`}>
                {(message.reactions || []).map(({ emoji, userIds }) => {
                  const me = userIds.includes(currentUserId);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => toggleReaction(message.id, emoji)}
                      className={`text-sm px-2 py-0.5 rounded-full border transition-colors ${
                        me ? 'bg-accent/30 border-accent' : 'bg-muted/50 border-transparent hover:bg-muted'
                      }`}
                    >
                      {emoji} {userIds.length}
                    </button>
                  );
                })}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 opacity-0 group-hover:opacity-100"
                    onClick={() => setShowReactionMessageId((id) => (id === message.id ? null : message.id))}
                    title="Add reaction"
                    aria-label="Add reaction"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                  {showReactionMessageId === message.id && (
                    <div className="absolute left-0 bottom-full mb-1 flex flex-wrap gap-1 p-2 rounded-lg bg-card border shadow-lg z-10 w-48">
                      {EMOJI_QUICK.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className="text-lg hover:scale-125"
                          onClick={() => toggleReaction(message.id, e)}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div ref={messagesEndRef} aria-hidden="true" />
    </div>
  );
}
