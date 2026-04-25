'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { formatEST } from '@/lib/format-date';

type AnnouncementRow = {
  id: string;
  announcement_type: string;
  reference_id: string;
  headline: string;
  cta_label: string;
  cta_path: string;
  created_at: string;
  expires_at: string;
  dismiss_count: number;
};

type CoachOpt = { id: string; first_name: string; last_name: string; school: string | null };
type FacilityOpt = { id: string; name: string; school: string | null };

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ParentAnnouncementsClient({
  coaches,
  facilities,
}: {
  coaches: CoachOpt[];
  facilities: FacilityOpt[];
}) {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [announcementType, setAnnouncementType] = useState<'new_coach' | 'new_location'>('new_coach');
  const [referenceId, setReferenceId] = useState('');
  const [headline, setHeadline] = useState('');
  const [ctaLabel, setCtaLabel] = useState('View Profile');
  const [ctaPath, setCtaPath] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date(Date.now() + 14 * 86400000);
    d.setHours(23, 59, 0, 0);
    return toDatetimeLocalValue(d.toISOString());
  });

  const [pickerCoach, setPickerCoach] = useState<string>('');
  const [pickerFacility, setPickerFacility] = useState<string>('');

  const [editRow, setEditRow] = useState<AnnouncementRow | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editCtaLabel, setEditCtaLabel] = useState('');
  const [editCtaPath, setEditCtaPath] = useState('');
  const [editExpires, setEditExpires] = useState('');

  const load = async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/parent-announcements');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load');
        return;
      }
      setRows(data.announcements ?? []);
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const applyCoachPick = (coachId: string) => {
    setPickerCoach(coachId);
    setPickerFacility('');
    const c = coaches.find((x) => x.id === coachId);
    if (!c) return;
    setAnnouncementType('new_coach');
    setReferenceId(c.id);
    setCtaPath(`/athlete/${c.id}`);
    const school = c.school?.trim() || 'their program';
    setHeadline(`New coach — ${c.first_name} ${c.last_name} from ${school}`);
  };

  const applyFacilityPick = (facilityId: string) => {
    setPickerFacility(facilityId);
    setPickerCoach('');
    const f = facilities.find((x) => x.id === facilityId);
    if (!f) return;
    setAnnouncementType('new_location');
    setReferenceId(f.id);
    setCtaPath(`/training?location=${encodeURIComponent(f.id)}`);
    setHeadline(`New training location — ${f.name}`);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const exp = new Date(expiresAt);
      const res = await fetch('/api/admin/parent-announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          announcement_type: announcementType,
          reference_id: referenceId,
          headline,
          cta_label: ctaLabel,
          cta_path: ctaPath,
          expires_at: exp.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Create failed');
        return;
      }
      setHeadline('');
      setCtaPath('');
      setReferenceId('');
      setPickerCoach('');
      setPickerFacility('');
      await load();
    } catch {
      setError('Create failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this announcement? Parents who dismissed it keep their dismissal record.')) return;
    const res = await fetch(`/api/admin/parent-announcements/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert((data as { error?: string }).error || 'Delete failed');
      return;
    }
    await load();
  };

  const openEdit = (r: AnnouncementRow) => {
    setEditRow(r);
    setEditHeadline(r.headline);
    setEditCtaLabel(r.cta_label);
    setEditCtaPath(r.cta_path);
    setEditExpires(toDatetimeLocalValue(r.expires_at));
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const exp = new Date(editExpires);
      const res = await fetch(`/api/admin/parent-announcements/${editRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: editHeadline,
          cta_label: editCtaLabel,
          cta_path: editCtaPath,
          expires_at: exp.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Update failed');
        return;
      }
      setEditRow(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Create announcement</CardTitle>
          <CardDescription>
            Shown at the top of the parent Home page until expired or dismissed.{' '}
            <code className="text-xs">reference_id</code> must match the coach or facility you pick.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-4 max-w-xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quick pick coach</Label>
                <Select
                  value={pickerCoach || '__none__'}
                  onValueChange={(v) => {
                    if (v === '__none__') {
                      setPickerCoach('');
                      return;
                    }
                    applyCoachPick(v);
                  }}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Optional — fills form for new coach" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                        {c.school ? ` · ${c.school}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quick pick facility</Label>
                <Select
                  value={pickerFacility || '__none__'}
                  onValueChange={(v) => {
                    if (v === '__none__') {
                      setPickerFacility('');
                      return;
                    }
                    applyFacilityPick(v);
                  }}
                >
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Optional — fills form for new location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {facilities.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                        {f.school ? ` · ${f.school}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-type">Type</Label>
              <Select
                value={announcementType}
                onValueChange={(v) => setAnnouncementType(v as 'new_coach' | 'new_location')}
              >
                <SelectTrigger id="ann-type" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_coach">New coach</SelectItem>
                  <SelectItem value="new_location">New location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref-id">Reference ID (UUID)</Label>
              <Input
                id="ref-id"
                className="min-h-[44px]"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="Coach athlete id or facility id"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                className="min-h-[44px]"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cta-label">Button label</Label>
                <Input
                  id="cta-label"
                  className="min-h-[44px]"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cta-path">Link path</Label>
                <Input
                  id="cta-path"
                  className="min-h-[44px]"
                  value={ctaPath}
                  onChange={(e) => setCtaPath(e.target.value)}
                  placeholder="/athlete/… or /training?location=…"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp">Expires (local)</Label>
              <Input
                id="exp"
                type="datetime-local"
                className="min-h-[44px]"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="min-h-[44px]" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish to parent home'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active &amp; past announcements</CardTitle>
          <CardDescription>
            Dismiss count = parents who tapped × for this type + reference (same pair can repeat if you
            re-publish).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Headline</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Expires</th>
                <th className="py-2 pr-3 font-medium">Dismissals</th>
                <th className="py-2 font-medium w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-muted-foreground">
                    No announcements yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const expired = new Date(r.expires_at) <= new Date();
                  return (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="py-3 pr-3 max-w-[240px]">
                        <div className="font-medium line-clamp-2">{r.headline}</div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{r.cta_path}</div>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {r.announcement_type === 'new_coach' ? 'Coach' : 'Location'}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {formatEST(new Date(r.expires_at), 'MMM d, yyyy h:mm a')}
                        {expired ? <span className="ml-1 text-destructive text-xs">(expired)</span> : null}
                      </td>
                      <td className="py-3 pr-3">{r.dismiss_count}</td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="min-h-[44px] min-w-[44px]"
                            aria-label="Edit"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="min-h-[44px] min-w-[44px] text-destructive"
                            aria-label="Delete"
                            onClick={() => onDelete(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="e-head">Headline</Label>
              <Input
                id="e-head"
                className="min-h-[44px]"
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-cta">Button label</Label>
              <Input
                id="e-cta"
                className="min-h-[44px]"
                value={editCtaLabel}
                onChange={(e) => setEditCtaLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-path">Link path</Label>
              <Input
                id="e-path"
                className="min-h-[44px]"
                value={editCtaPath}
                onChange={(e) => setEditCtaPath(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-exp">Expires</Label>
              <Input
                id="e-exp"
                type="datetime-local"
                className="min-h-[44px]"
                value={editExpires}
                onChange={(e) => setEditExpires(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
