'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
import { Copy, Check, Plus, X, Share2 } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { SESSION_FOCUS_AREAS } from '@/lib/focus-areas';

type Facility = { id: string; name: string; school: string; address?: string | null };

const SESSION_PRESETS = {
  small_group: { label: 'Small Group', price: 30, maxParticipants: 6, duration: 60 },
  partner: { label: 'Partner Session', price: 50, maxParticipants: 2, duration: 60 },
  private: { label: 'Private Session', price: 75, maxParticipants: 1, duration: 60 },
} as const;

type SessionTypeKey = keyof typeof SESSION_PRESETS;
type DateTimeEntry = { date: string; time: string };

export function CoachCreateSessionForm({
  coachId,
  coachName,
  facilities,
}: {
  coachId: string;
  coachName: string;
  facilities: Facility[];
}) {
  const [sessionType, setSessionType] = useState<SessionTypeKey>('small_group');
  const [joinPolicy, setJoinPolicy] = useState<'public' | 'invite_only'>('public');
  const [facilityId, setFacilityId] = useState(facilities[0]?.id || '');
  const [dateTimes, setDateTimes] = useState<DateTimeEntry[]>([{ date: '', time: '' }]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [pricePerParticipant, setPricePerParticipant] = useState(30);
  const [focusArea, setFocusArea] = useState('');
  const [focusArea2, setFocusArea2] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{
    shareUrl: string;
    scheduledDatetime: string;
    maxParticipants: number;
    pricePerParticipant: number;
  }>>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [focusAreaList, setFocusAreaList] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/focus-areas')
      .then((r) => r.json())
      .then((data) => data.focusAreas && data.focusAreas.length > 0 && setFocusAreaList(data.focusAreas))
      .catch(() => {});
  }, []);

  const focusOptions = focusAreaList.length > 0 ? focusAreaList : [...SESSION_FOCUS_AREAS];

  const handleSessionTypeChange = (type: SessionTypeKey) => {
    setSessionType(type);
    const preset = SESSION_PRESETS[type];
    setPricePerParticipant(preset.price);
    setMaxParticipants(preset.maxParticipants);
    setDurationMinutes(preset.duration);
  };

  const addDateTime = () => {
    const lastTime = dateTimes[dateTimes.length - 1]?.time || '';
    setDateTimes([...dateTimes, { date: '', time: lastTime }]);
  };

  const removeDateTime = (index: number) => {
    if (dateTimes.length > 1) {
      setDateTimes(dateTimes.filter((_, i) => i !== index));
    }
  };

  const updateDateTime = (index: number, field: 'date' | 'time', value: string) => {
    const updated = [...dateTimes];
    updated[index] = { ...updated[index], [field]: value };
    setDateTimes(updated);
  };

  const handleCopyLink = async (url: string, idx: number) => {
    await navigator.clipboard.writeText(url);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults([]);
    
    const validDateTimes = dateTimes.filter(dt => dt.date && dt.time);
    if (!facilityId || validDateTimes.length === 0) {
      setError('Please select facility and at least one date/time.');
      return;
    }
    
    setLoading(true);
    const createdSessions: typeof results = [];
    
    try {
      for (const dt of validDateTimes) {
        const res = await fetch('/api/admin/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            athleteId: coachId,
            facilityId,
            scheduledDate: dt.date,
            scheduledTime: dt.time,
            durationMinutes,
            maxParticipants,
            pricePerParticipant,
            sessionType,
            joinPolicy,
            focusArea: focusArea || undefined,
            focusArea2: focusArea2 || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || `Failed to create session for ${dt.date}`);
          continue;
        }
        createdSessions.push({
          shareUrl: data.shareUrl,
          scheduledDatetime: data.scheduledDatetime,
          maxParticipants: data.maxParticipants,
          pricePerParticipant: data.pricePerParticipant,
        });
      }
      
      if (createdSessions.length > 0) {
        setResults(createdSessions);
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Session Details</CardTitle>
        <CardDescription>
          Creating as <span className="font-medium text-foreground">{coachName}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-md bg-destructive/10 text-destructive px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {results.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="font-medium text-foreground flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-500" />
                {results.length} session{results.length > 1 ? 's' : ''} created
              </p>
            </div>
            
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium">
                    {formatEST(new Date(result.scheduledDatetime), 'EEEE, MMM d · h:mm a')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Up to {result.maxParticipants} athletes · ${Number(result.pricePerParticipant).toFixed(0)}/person
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={result.shareUrl}
                      className="font-mono text-xs h-9 flex-1"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-9 gap-1.5 shrink-0"
                      onClick={() => handleCopyLink(result.shareUrl, idx)}
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-500" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Share2 className="h-4 w-4" />
                          Share
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Share these links with parents via text or social. They can sign up directly.
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="default" size="sm">
                <Link href="/coach-sessions">View My Sessions</Link>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setResults([]);
                  setDateTimes([{ date: '', time: '' }]);
                }}
              >
                Create More
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Session Type */}
            <div>
              <Label>Session Type</Label>
              <Select value={sessionType} onValueChange={(v) => handleSessionTypeChange(v as SessionTypeKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small_group">Small Group ($30/person)</SelectItem>
                  <SelectItem value="partner">Partner ($50/person)</SelectItem>
                  <SelectItem value="private">Private ($75)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Facility */}
            <div>
              <Label>Facility</Label>
              <Select value={facilityId} onValueChange={setFacilityId} required>
                <SelectTrigger>
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

            {/* Focus Areas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Focus (1)</Label>
                <Select value={focusArea || '__none__'} onValueChange={(v) => setFocusArea(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="e.g. Takedowns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {focusOptions.map((area) => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Focus (2)</Label>
                <Select value={focusArea2 || '__none__'} onValueChange={(v) => setFocusArea2(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {focusOptions.filter((a) => a !== focusArea).map((area) => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date/Time */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Date & Time</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addDateTime} className="h-7 gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Add date
                </Button>
              </div>
              {dateTimes.map((dt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dt.date}
                    onChange={(e) => updateDateTime(idx, 'date', e.target.value)}
                    min={today}
                    className="flex-1"
                    required={idx === 0}
                  />
                  <Input
                    type="time"
                    value={dt.time}
                    onChange={(e) => updateDateTime(idx, 'time', e.target.value)}
                    className="w-28"
                    required={idx === 0}
                  />
                  {dateTimes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDateTime(idx)}
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Capacity & Price */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Duration</Label>
                <Select value={String(durationMinutes)} onValueChange={(v) => setDurationMinutes(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                    <SelectItem value="90">90 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max athletes</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={pricePerParticipant}
                  onChange={(e) => setPricePerParticipant(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Who Can Join */}
            <div>
              <Label>Who Can Join</Label>
              <Select value={joinPolicy} onValueChange={(v) => setJoinPolicy(v as 'public' | 'invite_only')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Anyone with link</SelectItem>
                  <SelectItem value="invite_only">Invite only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading} className="w-full min-h-[48px] bg-[#D4AF37] hover:bg-[#B8963C] text-black font-medium">
              {loading 
                ? 'Creating…' 
                : dateTimes.filter(dt => dt.date && dt.time).length > 1 
                  ? `Create ${dateTimes.filter(dt => dt.date && dt.time).length} Sessions`
                  : 'Create Session'
              }
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
