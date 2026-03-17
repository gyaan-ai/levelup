'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Copy, Check } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { SESSION_FOCUS_AREAS } from '@/lib/focus-areas';

type Athlete = { id: string; name: string; school: string };
type Facility = { id: string; name: string; school: string; address?: string | null };

export function CreateSessionForm({
  athletes,
  facilities,
}: {
  athletes: Athlete[];
  facilities: Facility[];
}) {
  const [athleteId, setAthleteId] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [pricePerParticipant, setPricePerParticipant] = useState(30);
  const [focusArea, setFocusArea] = useState('');
  const [focusArea2, setFocusArea2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    shareUrl: string;
    partnerInviteCode: string;
    scheduledDatetime: string;
    maxParticipants: number;
    pricePerParticipant: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [focusAreaList, setFocusAreaList] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/focus-areas')
      .then((r) => r.json())
      .then((data) => data.focusAreas && data.focusAreas.length > 0 && setFocusAreaList(data.focusAreas))
      .catch(() => {});
  }, []);

  const focusOptions = focusAreaList.length > 0 ? focusAreaList : [...SESSION_FOCUS_AREAS];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!athleteId || !facilityId || !scheduledDate || !scheduledTime) {
      setError('Please select coach, facility, date, and time.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId,
          facilityId,
          scheduledDate,
          scheduledTime,
          durationMinutes,
          maxParticipants,
          pricePerParticipant,
          focusArea: focusArea || undefined,
          focusArea2: focusArea2 || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create session');
        return;
      }
      setResult({
        shareUrl: data.shareUrl,
        partnerInviteCode: data.partnerInviteCode,
        scheduledDatetime: data.scheduledDatetime,
        maxParticipants: data.maxParticipants,
        pricePerParticipant: data.pricePerParticipant,
      });
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!result?.shareUrl) return;
    navigator.clipboard.writeText(result.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Session details</CardTitle>
        <CardDescription>
          Choose coach and facility, set date/time and capacity. You’ll get a shareable link to send to families.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {result ? (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <p className="font-medium text-foreground">Session created</p>
            <p className="text-sm text-muted-foreground">
              {formatEST(new Date(result.scheduledDatetime), 'EEEE, MMM d, yyyy h:mm a')}
              {' · '}
              Up to {result.maxParticipants} participants · ${Number(result.pricePerParticipant).toFixed(2)}/person
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                readOnly
                value={result.shareUrl}
                className="font-mono text-sm"
              />
              <Button variant="outline" size="sm" onClick={copyLink} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with parents. They can open it, sign in, choose their wrestler, and join the session.
            </p>
            <Button variant="ghost" onClick={() => setResult(null)}>
              Create another session
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="coach">Coach</Label>
              <Select value={athleteId} onValueChange={setAthleteId} required>
                <SelectTrigger id="coach">
                  <SelectValue placeholder="Select coach" />
                </SelectTrigger>
                <SelectContent>
                  {athletes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.school ? ` — ${a.school}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
<div>
                <Label htmlFor="focus">Focus area (1)</Label>
                <Select
                  value={focusArea || '__none__'}
                  onValueChange={(v) => setFocusArea(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger id="focus">
                    <SelectValue placeholder="e.g. Takedowns, Escapes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {focusOptions.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="focus2">Focus area (2) — optional</Label>
                <Select
                  value={focusArea2 || '__none__'}
                  onValueChange={(v) => setFocusArea2(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger id="focus2">
                    <SelectValue placeholder="Second topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {focusOptions.filter((a) => a !== focusArea).map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            <div>
                <Label htmlFor="facility">Facility</Label>
                <Select value={facilityId} onValueChange={setFacilityId} required>
                <SelectTrigger id="facility">
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                      {f.school ? ` — ${f.school}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={today}
                  required
                />
              </div>
              <div>
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="duration">Duration (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={30}
                  max={120}
                  step={15}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
                />
              </div>
              <div>
                <Label htmlFor="max">Max participants</Label>
                <Input
                  id="max"
                  type="number"
                  min={2}
                  max={20}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value) || 6)}
                />
              </div>
              <div>
                <Label htmlFor="price">Price per person ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step={5}
                  value={pricePerParticipant}
                  onChange={(e) => setPricePerParticipant(Number(e.target.value) || 30)}
                />
              </div>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create session & get link'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
