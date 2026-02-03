'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Target,
  Video,
  FileText,
  CheckSquare,
  Plus,
  Loader2,
  Upload,
  MessageCircle,
  Pencil,
  Trash2,
  X,
  Check,
  Smile,
} from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';

type Goal = { id: string; content: string; created_at: string };
type Media = { id: string; file_name: string; media_type: string; description?: string; viewUrl?: string; created_at: string };
type Note = { id: string; summary: string; highlights?: string; focus_areas?: string; created_at: string; sessions?: { scheduled_datetime: string } };
type Action = { id: string; content: string; completed: boolean; created_at: string };
type Reaction = { emoji: string; userIds: string[] };
type Message = {
  id: string;
  content: string;
  author_id: string;
  authorName: string;
  authorPhoto: string | null;
  created_at: string;
  updated_at?: string;
  isEdited?: boolean;
  reactions: Reaction[];
};

const EMOJI_OPTIONS = ['👍', '🎯', '💪', '🔥', '👏', '❤️'];

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function WorkspaceClient({ workspaceId, isCoach = false }: { workspaceId: string; isCoach?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<{
    workspace: { youth_wrestlers?: { first_name?: string; last_name?: string }; athletes?: { first_name?: string; last_name?: string; school?: string } };
    currentUserId?: string;
    goals: Goal[];
    media: Media[];
    notes: Note[];
    actions: Action[];
    messages: Message[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingGoal, setAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState({ summary: '', highlights: '', focusAreas: '' });
  const [addingAction, setAddingAction] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}`);
    if (!res.ok) {
      router.push('/workspaces');
      return;
    }
    const json = await res.json();
    setData(json);
  }, [workspaceId, router]);

  useEffect(() => {
    load();
    setLoading(false);
  }, [load]);

  const addGoal = async () => {
    if (!newGoal.trim()) return;
    setAddingGoal(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newGoal.trim() }),
      });
      if (res.ok) {
        setNewGoal('');
        load();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add goal');
      }
    } finally {
      setAddingGoal(false);
    }
  };

  const addNote = async () => {
    if (!newNote.summary.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: newNote.summary.trim(),
          highlights: newNote.highlights.trim() || undefined,
          focusAreas: newNote.focusAreas.trim() || undefined,
        }),
      });
      if (res.ok) {
        setNewNote({ summary: '', highlights: '', focusAreas: '' });
        load();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add note');
      }
    } finally {
      setAddingNote(false);
    }
  };

  const addAction = async () => {
    if (!newAction.trim()) return;
    setAddingAction(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newAction.trim() }),
      });
      if (res.ok) {
        setNewAction('');
        load();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add action');
      }
    } finally {
      setAddingAction(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (res.ok) {
        setNewMessage('');
        load();
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to send message');
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const editMessage = async (msgId: string) => {
    if (!editContent.trim()) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent.trim() }),
    });
    if (res.ok) {
      setEditingId(null);
      setEditContent('');
      load();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to edit');
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!confirm('Delete this message?')) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/messages/${msgId}`, { method: 'DELETE' });
    if (res.ok) load();
    else alert('Failed to delete');
  };

  const toggleReaction = async (msgId: string, emoji: string) => {
    const msg = data?.messages.find((m) => m.id === msgId);
    const hasReacted = msg?.reactions.some((r) => r.emoji === emoji && r.userIds.includes(data?.currentUserId || ''));
    if (hasReacted) {
      await fetch(`/api/workspaces/${workspaceId}/messages/${msgId}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/workspaces/${workspaceId}/messages/${msgId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
    }
    setShowEmojiPicker(null);
    load();
  };

  const toggleAction = async (actionId: string, completed: boolean) => {
    const res = await fetch(`/api/workspaces/${workspaceId}/actions/${actionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    if (res.ok) load();
  };

  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', '');
      const res = await fetch(`/api/workspaces/${workspaceId}/media`, {
        method: 'POST',
        body: formData,
      });
      const text = await res.text();
      if (res.ok) {
        load();
      } else {
        try {
          const err = JSON.parse(text);
          alert(err.error || 'Upload failed');
        } catch {
          alert(text || 'Upload failed');
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (loading || !data) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const yw = Array.isArray(data.workspace.youth_wrestlers) ? data.workspace.youth_wrestlers[0] : data.workspace.youth_wrestlers;
  const coach = Array.isArray(data.workspace.athletes) ? data.workspace.athletes[0] : data.workspace.athletes;
  const wrestlerName = yw ? `${yw.first_name || ''} ${yw.last_name || ''}`.trim() : 'Wrestler';
  const coachName = coach ? `${coach.first_name || ''} ${coach.last_name || ''}`.trim() : 'Coach';

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/workspaces" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to workspaces
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary">{wrestlerName}</h1>
        <p className="text-muted-foreground flex items-center gap-2 mt-1">
          with {coachName}
          {coach?.school && (
            <>
              <SchoolLogo school={coach.school} size="sm" />
              <span>({coach.school})</span>
            </>
          )}
        </p>
      </div>

      {/* Collaboration - modern messaging */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Collaboration
          </CardTitle>
          <CardDescription>
            Parent, coach, and athlete can message back and forth
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {(data.messages || []).map((msg) => {
              const isOwn = msg.author_id === data?.currentUserId;
              const isEditing = editingId === msg.id;
              return (
                <div key={msg.id} className="group flex gap-3">
                  {/* Avatar */}
                  <div className="shrink-0">
                    {msg.authorPhoto ? (
                      <Image src={msg.authorPhoto} alt="" width={36} height={36} className="rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-sm font-medium">
                        {msg.authorName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Header: name + time + actions */}
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold">{msg.authorName}</span>
                      <span className="text-xs text-muted-foreground">{relativeTime(msg.created_at)}</span>
                      {msg.isEdited && <span className="text-xs text-muted-foreground">(edited)</span>}
                      {isOwn && !isEditing && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-auto">
                          <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }} className="p-1 hover:bg-muted rounded" title="Edit">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => deleteMessage(msg.id)} className="p-1 hover:bg-muted rounded" title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Content / Edit mode */}
                    {isEditing ? (
                      <div className="flex gap-2 items-start">
                        <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} className="text-sm resize-none" autoFocus />
                        <Button size="sm" onClick={() => editMessage(msg.id)} disabled={!editContent.trim()}><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {/* Reactions */}
                    {!isEditing && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {msg.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => toggleReaction(msg.id, r.emoji)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                              r.userIds.includes(data?.currentUserId || '') ? 'bg-accent/20 border-accent' : 'bg-muted/50 border-transparent hover:border-muted-foreground/30'
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="font-medium">{r.userIds.length}</span>
                          </button>
                        ))}
                        {/* Add reaction button */}
                        <div className="relative">
                          <button onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)} className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <Smile className="h-4 w-4 text-muted-foreground" />
                          </button>
                          {showEmojiPicker === msg.id && (
                            <div className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 bg-background border rounded-lg shadow-lg z-10">
                              {EMOJI_OPTIONS.map((e) => (
                                <button key={e} onClick={() => toggleReaction(msg.id, e)} className="p-1 hover:bg-muted rounded text-lg">
                                  {e}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {(data?.messages ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No messages yet. Start the conversation!</p>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* Composer */}
          <div className="flex gap-2 pt-2 border-t">
            <Textarea
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={2}
              className="resize-none"
            />
            <Button onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()}>
              {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Goals — What to work on
            </CardTitle>
            <CardDescription>Parents and coaches can add goals for the wrestler</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.goals.map((g) => (
              <div key={g.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                {g.content}
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Add a goal..."
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                disabled={addingGoal}
              />
              <Button onClick={addGoal} disabled={addingGoal || !newGoal.trim()}>
                {addingGoal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Media / Video */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video & Media
            </CardTitle>
            <CardDescription>Upload video for coach review or reference</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.media.map((m) => (
              <div key={m.id} className="rounded-lg border overflow-hidden">
                {m.media_type === 'video' && m.viewUrl && (
                  <video src={m.viewUrl} controls className="w-full max-h-48" />
                )}
                {m.media_type === 'image' && m.viewUrl && (
                  <img src={m.viewUrl} alt={m.file_name} className="w-full max-h-48 object-cover" />
                )}
                <div className="p-2 text-sm text-muted-foreground">{m.file_name}</div>
              </div>
            ))}
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
              <input type="file" accept="video/*,image/*" className="hidden" onChange={uploadMedia} disabled={uploading} />
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground">Upload video or image</span>
                </>
              )}
            </label>
          </CardContent>
        </Card>

        {/* Session Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Session Summaries
            </CardTitle>
            <CardDescription>Coach summaries after each session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.notes.map((n) => (
              <div key={n.id} className="p-4 rounded-lg border space-y-2">
                <p className="text-sm font-medium">{n.summary}</p>
                {n.highlights && <p className="text-sm text-muted-foreground">Highlights: {n.highlights}</p>}
                {n.focus_areas && <p className="text-sm text-muted-foreground">Focus: {n.focus_areas}</p>}
              </div>
            ))}
            {isCoach && (
              <div className="space-y-2">
                <Textarea placeholder="Session summary..." value={newNote.summary} onChange={(e) => setNewNote((x) => ({ ...x, summary: e.target.value }))} rows={3} />
                <Input placeholder="Highlights (optional)" value={newNote.highlights} onChange={(e) => setNewNote((x) => ({ ...x, highlights: e.target.value }))} />
                <Input placeholder="Focus areas (optional)" value={newNote.focusAreas} onChange={(e) => setNewNote((x) => ({ ...x, focusAreas: e.target.value }))} />
                <Button onClick={addNote} disabled={addingNote || !newNote.summary.trim()}>
                  {addingNote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add session note
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Action Items
            </CardTitle>
            <CardDescription>Coach-assigned homework before next session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.actions.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <button
                  onClick={() => toggleAction(a.id, !a.completed)}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${a.completed ? 'bg-primary border-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  {a.completed && <span className="text-xs font-bold">✓</span>}
                </button>
                <span className={a.completed ? 'line-through text-muted-foreground' : ''}>{a.content}</span>
              </div>
            ))}
            {isCoach && (
              <div className="flex gap-2">
                <Input
                  placeholder="Add action for next session..."
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAction()}
                  disabled={addingAction}
                />
                <Button onClick={addAction} disabled={addingAction || !newAction.trim()}>
                  {addingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
