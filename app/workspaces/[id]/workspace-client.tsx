'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';
import { MessagesSection } from '@/components/workspace/messages-section';
import { SessionsSection } from '@/components/workspace/sessions-section';
import { ActionItemsSection } from '@/components/workspace/action-items-section';
import { CollapsibleSection } from '@/components/workspace/collapsible-section';
import { ActivityFeed } from '@/components/workspace/activity-feed';
import { generateActivityFeed, calculateNewIndicators } from '@/lib/utils/generate-activity-feed';

type Goal = { id: string; content: string; created_at: string; completed_at?: string | null };
type Media = { id: string; file_name: string; media_type: string; description?: string | null; viewUrl?: string | null; created_at: string; uploaded_by?: { name?: string } | string | null };
type Note = { id: string; summary: string; highlights?: string; focus_areas?: string; created_at: string; sessions?: { scheduled_datetime: string } };
type Action = {
  id: string;
  content: string;
  description?: string | null;
  status: 'pending' | 'completed' | string;
  due_date?: string | null;
  created_at: string;
  completed_at?: string | null;
};
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

type SessionSummary = {
  id: string;
  focus_areas: string[];
  what_we_worked_on: string;
  progress_notes: string | null;
  next_session_plan: string | null;
  overall_effort: number | null;
  technical_progress: number | null;
  created_at: string;
};

type SessionItem = {
  id: string;
  scheduled_datetime: string;
  status: string;
  summary: SessionSummary | null;
};

export function WorkspaceClient({ workspaceId, isCoach = false }: { workspaceId: string; isCoach?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<{
    workspace: {
      parent_id?: string;
      athlete_id?: string;
      youth_wrestlers?: { first_name?: string; last_name?: string };
      athletes?: { first_name?: string; last_name?: string; school?: string };
    };
    currentUserId?: string;
    goals: Goal[];
    media: Media[];
    notes: Note[];
    actions: Action[];
    messages: Message[];
    sessions: SessionItem[];
    currentUserRole?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingGoal, setAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState({ summary: '', highlights: '', focusAreas: '' });
  const [uploading, setUploading] = useState(false);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [mediaNoteDraft, setMediaNoteDraft] = useState('');
  const [savingMediaNote, setSavingMediaNote] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [showActionForm, setShowActionForm] = useState(false);
  const [lastVisit, setLastVisit] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}`);
    if (!res.ok) {
      router.push('/workspaces');
      return;
    }
    const json = await res.json();
    setData(json);
    setEditingMediaId(null);
    setMediaNoteDraft('');
    setDeletingMediaId(null);
  }, [workspaceId, router]);

  useEffect(() => {
    load();
    setLoading(false);
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `workspace-${workspaceId}-last-visit`;
    const stored = localStorage.getItem(key);
    if (stored) {
      setLastVisit(stored);
    }
    localStorage.setItem(key, new Date().toISOString());
  }, [workspaceId]);

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

  const beginEditMediaNote = (media: Media) => {
    setEditingMediaId(media.id);
    setMediaNoteDraft(media.description || '');
  };

  const saveMediaNote = async (mediaId: string) => {
    if (savingMediaNote) return;
    setSavingMediaNote(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: mediaNoteDraft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to save notes');
      } else {
        setEditingMediaId(null);
        setMediaNoteDraft('');
        load();
      }
    } finally {
      setSavingMediaNote(false);
    }
  };

  const deleteMedia = async (mediaId: string) => {
    if (!confirm('Delete this media item?')) return;
    setDeletingMediaId(mediaId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/media/${mediaId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to delete media');
      } else {
        load();
      }
    } finally {
      setDeletingMediaId(null);
    }
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

  const activities = useMemo(
    () =>
      data
        ? generateActivityFeed({
            messages: data.messages,
            sessions: data.sessions,
            actions: data.actions,
            media: data.media,
            goals: data.goals,
            currentUserId: data.currentUserId,
          })
        : [],
    [data]
  );

  const indicators = useMemo(
    () =>
      data
        ? calculateNewIndicators(
            {
              messages: data.messages,
              sessions: data.sessions,
              actions: data.actions,
              media: data.media,
              goals: data.goals,
              currentUserId: data.currentUserId,
            },
            lastVisit || undefined
          )
        : null,
    [data, lastVisit]
  );

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
  const userRole = data.currentUserRole;

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

      <ActivityFeed activities={activities} />

      <CollapsibleSection
        title="Collaboration"
        description="Parent, coach, and athlete can message back and forth. Updates in real time."
        icon={<MessageCircle className="h-5 w-5" />}
        badge={indicators?.messages.count}
        hasNew={Boolean(indicators?.messages.hasNew)}
        newLabel={indicators?.messages.label}
        defaultOpen={false}
      >
        <div className="h-[600px] min-h-[400px]">
          <MessagesSection workspaceId={workspaceId} currentUserId={data.currentUserId ?? ''} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Action Items"
        description="Homework assigned by coach"
        icon={<CheckSquare className="h-5 w-5" />}
        badge={indicators?.actions.count}
        hasNew={Boolean(indicators?.actions.hasNew)}
        newLabel={indicators?.actions.label}
        action={
          userRole === 'athlete'
            ? {
                label: showActionForm ? 'Close' : 'Assign Homework',
                onClick: () => setShowActionForm((prev) => !prev),
              }
            : undefined
        }
      >
        <ActionItemsSection
          workspaceId={workspaceId}
          isCoach={userRole === 'athlete'}
          showForm={showActionForm}
          onCloseForm={() => setShowActionForm(false)}
          onRefresh={load}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Goals — What to work on"
        description="Parents and coaches can add goals for the wrestler"
        icon={<Target className="h-5 w-5" />}
        badge={data.goals.length}
        hasNew={false}
      >
        <div className="space-y-4">
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
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Video & Media"
        description="Upload video for coach review or reference"
        icon={<Video className="h-5 w-5" />}
        hasNew={Boolean(indicators?.videos.hasNew)}
        newLabel={indicators?.videos.label}
      >
        <div className="space-y-4">
          {data.media.map((m) => (
            <div key={m.id} className="rounded-lg border overflow-hidden group/media">
              {m.media_type === 'video' && m.viewUrl && <video src={m.viewUrl} controls className="w-full max-h-48" />}
              {m.media_type === 'image' && m.viewUrl && <img src={m.viewUrl} alt={m.file_name} className="w-full max-h-48 object-cover" />}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground truncate">{m.file_name}</span>
                  <button
                    onClick={() => deleteMedia(m.id)}
                    disabled={deletingMediaId === m.id}
                    className="shrink-0 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    {deletingMediaId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
                {editingMediaId === m.id ? (
                  <div className="flex gap-2">
                    <Textarea
                      value={mediaNoteDraft}
                      onChange={(e) => setMediaNoteDraft(e.target.value)}
                      placeholder="Add notes..."
                      rows={2}
                      className="text-sm resize-none"
                      autoFocus
                    />
                    <div className="flex flex-col gap-1">
                      <Button size="sm" onClick={() => saveMediaNote(m.id)} disabled={savingMediaNote}>
                        {savingMediaNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingMediaId(null); setMediaNoteDraft(''); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => beginEditMediaNote(m)}
                    className="text-sm text-muted-foreground min-h-[2rem] py-1 px-2 -mx-2 rounded hover:bg-muted/50 cursor-text"
                  >
                    {m.description ? m.description : <span className="italic">Tap to add notes...</span>}
                  </div>
                )}
              </div>
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
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Session History"
        description="Summaries from your private sessions"
        icon={<FileText className="h-5 w-5" />}
        hasNew={Boolean(indicators?.summaries.hasNew)}
        newLabel={indicators?.summaries.label}
      >
        <div className="space-y-6">
          <div className="space-y-4">
            {data.notes.map((n) => (
              <div key={n.id} className="p-4 rounded-lg border space-y-2">
                <p className="text-sm font-medium">{n.summary}</p>
                {n.highlights && <p className="text-sm text-muted-foreground">Highlights: {n.highlights}</p>}
                {n.focus_areas && <p className="text-sm text-muted-foreground">Focus: {n.focus_areas}</p>}
              </div>
            ))}
            {isCoach && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Session summary..."
                  value={newNote.summary}
                  onChange={(e) => setNewNote((x) => ({ ...x, summary: e.target.value }))}
                  rows={3}
                />
                <Input
                  placeholder="Highlights (optional)"
                  value={newNote.highlights}
                  onChange={(e) => setNewNote((x) => ({ ...x, highlights: e.target.value }))}
                />
                <Input
                  placeholder="Focus areas (optional)"
                  value={newNote.focusAreas}
                  onChange={(e) => setNewNote((x) => ({ ...x, focusAreas: e.target.value }))}
                />
                <Button onClick={addNote} disabled={addingNote || !newNote.summary.trim()}>
                  {addingNote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add session note
                </Button>
              </div>
            )}
          </div>
          <div className="border-t pt-4">
            <SessionsSection
              workspaceId={workspaceId}
              sessions={data.sessions || []}
              isCoach={userRole === 'athlete'}
              onRefresh={load}
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
