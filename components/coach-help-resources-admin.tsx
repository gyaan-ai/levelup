'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COACH_HELP_FEATURED_HOME_SCREEN_KEY } from '@/lib/coach-help-video-keys';

export type CoachHelpResourceRow = {
  id: string;
  title: string;
  url: string;
  created_at: string;
};

type Props = {
  initialResources: CoachHelpResourceRow[];
};

type StatRow = {
  video_key: string;
  view_count: number;
  unique_viewers: number;
  up_count: number;
  down_count: number;
};

function videoKeyLabel(key: string): string {
  if (key === COACH_HELP_FEATURED_HOME_SCREEN_KEY) return 'Featured · home screen tutorial';
  if (key.startsWith('resource:')) return `Extra how-to (${key.slice('resource:'.length).slice(0, 8)}…)`;
  return key;
}

export function CoachHelpResourcesAdmin({ initialResources }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatRow[] | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsTick, setStatsTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/admin/coach-help/stats');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setStatsError(typeof data?.error === 'string' ? data.error : 'Could not load stats.');
          return;
        }
        const rows = Array.isArray(data.stats) ? data.stats : [];
        if (!cancelled) {
          setStats(
            rows.map((r: Record<string, unknown>) => ({
              video_key: String(r.video_key ?? ''),
              view_count: Number(r.view_count ?? 0),
              unique_viewers: Number(r.unique_viewers ?? 0),
              up_count: Number(r.up_count ?? 0),
              down_count: Number(r.down_count ?? 0),
            })),
          );
          setStatsError(null);
        }
      } catch {
        if (!cancelled) setStatsError('Could not load stats.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statsTick]);

  function refresh() {
    startTransition(() => {
      setStatsTick((t) => t + 1);
      router.refresh();
    });
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/coach-help-resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), url: url.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data?.error === 'string' ? data.error : 'Could not add link.');
      return;
    }
    setTitle('');
    setUrl('');
    refresh();
  }

  async function onDelete(id: string) {
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/coach-help-resources/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Could not remove link.');
        return;
      }
      refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="border-dashed border-amber-700/50 bg-amber-950/10 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="text-lg">Coach resources (admin)</CardTitle>
        <CardDescription>
          Add Loom or YouTube links. They appear under &quot;More how-tos&quot; for coaches on this page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onAdd} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="coach-help-res-title">Title</Label>
            <Input
              id="coach-help-res-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Recording a session summary"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coach-help-res-url">Loom or YouTube URL</Label>
            <Input
              id="coach-help-res-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.loom.com/share/…"
              autoComplete="off"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            disabled={submitting || deletingId !== null || !title.trim() || !url.trim()}
            className="min-h-[44px]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Add how-to
          </Button>
        </form>

        {initialResources.length > 0 ? (
          <ul className="divide-y divide-border rounded-md border text-sm">
            {initialResources.map((r) => (
              <li key={r.id} className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{r.title}</p>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground break-all"
                  >
                    {r.url}
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                  </a>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  disabled={deletingId === r.id}
                  onClick={() => onDelete(r.id)}
                  aria-label={`Remove ${r.title}`}
                >
                  {deletingId === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No extra how-tos yet. Add a link above.</p>
        )}

        <div className="border-t border-border/60 pt-4 space-y-2">
          <p className="text-sm font-medium text-foreground">Engagement (views &amp; votes)</p>
          {statsError ? <p className="text-sm text-destructive">{statsError}</p> : null}
          {!statsError && stats && stats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : null}
          {!statsError && stats && stats.length > 0 ? (
            <div className="overflow-x-auto rounded-md border text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-2 font-medium">Video</th>
                    <th className="p-2 font-medium tabular-nums">Opens</th>
                    <th className="p-2 font-medium tabular-nums">Coaches</th>
                    <th className="p-2 font-medium tabular-nums">Up</th>
                    <th className="p-2 font-medium tabular-nums">Down</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.video_key} className="border-b border-border/50 last:border-0">
                      <td className="p-2 max-w-[200px]">{videoKeyLabel(s.video_key)}</td>
                      <td className="p-2 tabular-nums">{s.view_count}</td>
                      <td className="p-2 tabular-nums">{s.unique_viewers}</td>
                      <td className="p-2 tabular-nums">{s.up_count}</td>
                      <td className="p-2 tabular-nums">{s.down_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Opens counts each embed load and each &quot;open in new tab&quot; click. Per-coach totals appear in the
            coach UI on this page.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
