'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Users, UserPlus, Pencil, Smile } from 'lucide-react';
import { formatEST } from '@/lib/format-date';

const EMOJI_QUICK = ['👍', '❤️', '😂', '🔥', '💪', '✅', '👀', '🙌'];

type Message = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  attachmentUrl: string | null;
  reactions: Array<{ userId: string; emoji: string }>;
};

type Member = { userId: string; role: string; name: string; isCoach: boolean };
type Kid = { youthWrestlerId: string; name: string; parentId: string | null };

export function GroupChannelClient({
  groupId,
  groupName,
  initialMembers,
  initialKids,
  currentUserId,
  isCoach,
}: {
  groupId: string;
  groupName: string;
  initialMembers: Member[];
  initialKids: Kid[];
  currentUserId: string;
  isCoach: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [kids, setKids] = useState<Kid[]>(initialKids);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [addKidOpen, setAddKidOpen] = useState(false);
  const [addableKids, setAddableKids] = useState<Array<{ id: string; name: string }>>([]);
  const [showEmojiMessageId, setShowEmojiMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const r = await fetch(`/api/messaging-groups/${groupId}/messages`);
      const data = await r.json();
      if (r.ok && data.messages) setMessages(data.messages);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchGroup = async () => {
    try {
      const r = await fetch(`/api/messaging-groups/${groupId}`);
      const data = await r.json();
      if (r.ok) {
        if (data.members) setMembers(data.members);
        if (data.kids) setKids(data.kids);
      }
    } catch {
      /* ignore */
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/messaging-groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setDraft('');
      await fetchMessages();
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const startEdit = (m: Message) => {
    if (m.authorId !== currentUserId) return;
    setEditingId(m.id);
    setEditBody(m.body);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const r = await fetch(`/api/messaging-groups/${groupId}/messages/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody.trim() }),
      });
      if (!r.ok) throw new Error();
      setEditingId(null);
      await fetchMessages();
    } catch {
      /* ignore */
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const msg = messages.find((m) => m.id === messageId);
      const existing = msg?.reactions.find((r) => r.userId === currentUserId && r.emoji === emoji);
      if (existing) {
        await fetch(`/api/messaging-groups/${groupId}/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/messaging-groups/${groupId}/messages/${messageId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        });
      }
      await fetchMessages();
    } catch {
      /* ignore */
    }
  };

  const openAddKid = async () => {
    setAddKidOpen(true);
    try {
      const r = await fetch(`/api/messaging-groups/${groupId}/addable-kids`);
      const data = await r.json();
      if (r.ok && data.kids) setAddableKids(data.kids.map((k: { id: string; name: string }) => ({ id: k.id, name: k.name })));
      else setAddableKids([]);
    } catch {
      setAddableKids([]);
    }
  };

  const addKid = async (youthWrestlerId: string) => {
    try {
      const r = await fetch(`/api/messaging-groups/${groupId}/kids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youthWrestlerId }),
      });
      if (!r.ok) throw new Error();
      setAddKidOpen(false);
      await fetchGroup();
    } catch {
      /* ignore */
    }
  };

  const reactionCounts = (msg: Message) => {
    const map = new Map<string, { count: number; me: boolean }>();
    for (const r of msg.reactions) {
      const key = r.emoji;
      const cur = map.get(key) ?? { count: 0, me: false };
      cur.count += 1;
      if (r.userId === currentUserId) cur.me = true;
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([emoji, { count, me }]) => ({ emoji, count, me }));
  };

  return (
    <div className="flex flex-1 min-w-0 h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Link href="/inbox" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-semibold truncate">{groupName}</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet. Say something!</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="group flex flex-col gap-0.5">
                <div className="flex items-start gap-2">
                  <div className={`rounded-lg px-3 py-2 max-w-[85%] ${m.authorId === currentUserId ? 'bg-accent/20 ml-auto' : 'bg-muted'}`}>
                    {editingId === m.id ? (
                      <div className="flex gap-2">
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={2}
                          className="min-w-[200px] resize-none"
                        />
                        <div className="flex flex-col gap-1">
                          <Button size="sm" onClick={saveEdit}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-0.5">{m.authorName}</p>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatEST(new Date(m.createdAt), 'M/d/yyyy, h:mm a')}
                          {m.editedAt && ' (edited)'}
                        </p>
                      </>
                    )}
                  </div>
                  {editingId !== m.id && m.authorId === currentUserId && (
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8 shrink-0" onClick={() => startEdit(m)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 ml-1">
                  {reactionCounts(m).map(({ emoji, count, me }) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => toggleReaction(m.id, emoji)}
                      className={`text-sm px-2 py-0.5 rounded-full border transition-colors ${me ? 'bg-accent/30 border-accent' : 'bg-muted/50 border-transparent hover:bg-muted'}`}
                    >
                      {emoji} {count}
                    </button>
                  ))}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 opacity-0 group-hover:opacity-100"
                      onClick={() => setShowEmojiMessageId((id) => (id === m.id ? null : m.id))}
                      title="Add reaction"
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                    {showEmojiMessageId === m.id && (
                      <div className="absolute left-0 bottom-full mb-1 flex flex-wrap gap-1 p-2 rounded-lg bg-card border shadow-lg z-10 w-48">
                        {EMOJI_QUICK.map((e) => (
                          <button
                            key={e}
                            type="button"
                            className="text-lg hover:scale-125"
                            onClick={() => { toggleReaction(m.id, e); setShowEmojiMessageId(null); }}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t border-border flex gap-2">
          <Textarea
            placeholder="Type a message… (full emoji supported)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            className="resize-none flex-1 min-w-0"
          />
          <Button size="icon" onClick={handleSend} disabled={!draft.trim() || sending} className="shrink-0 h-auto">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <aside className="w-64 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium">Members &amp; kids</span>
          {isCoach && (
            <Button variant="ghost" size="sm" onClick={openAddKid} className="h-8">
              <UserPlus className="h-4 w-4 mr-1" />
              Add kid
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Members</p>
            <ul className="space-y-1.5">
              {members.map((mem) => (
                <li key={mem.userId} className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{mem.name}</span>
                  {mem.isCoach && <span className="text-xs text-accent shrink-0">Coach</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Kids in group</p>
            {kids.length === 0 ? (
              <p className="text-sm text-muted-foreground">None added yet</p>
            ) : (
              <ul className="space-y-1.5">
                {kids.map((k) => (
                  <li key={k.youthWrestlerId} className="text-sm truncate">{k.name}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {addKidOpen && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-20 p-4">
            <Card className="w-full max-w-sm">
              <CardContent className="pt-4">
                <p className="font-medium mb-2">Add a kid to this group</p>
                <p className="text-sm text-muted-foreground mb-3">Their parent will be added as a member.</p>
                {addableKids.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No more kids to add (you’ve had sessions with).</p>
                ) : (
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {addableKids.map((k) => (
                      <li key={k.id}>
                        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addKid(k.id)}>
                          {k.name}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="ghost" className="mt-3 w-full" onClick={() => setAddKidOpen(false)}>
                  Close
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </aside>
    </div>
  );
}
