'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { ProfileImage } from '@/components/profile-image';
import { SchoolLogo } from '@/components/school-logo';
import type { YouthWrestler } from '@/types';

type Athlete = {
  id: string;
  first_name: string;
  last_name: string;
  school: string;
  photo_url?: string;
  photo_focus_x?: number;
  photo_focus_y?: number;
};

type Facility = { id: string; name: string; school?: string };

type Props = {
  athlete: Athlete;
  facilities: Facility[];
  youthWrestlers: YouthWrestler[];
  preselectedYouthWrestlerId?: string | null;
};

export function RequestSessionClient({
  athlete,
  facilities,
  youthWrestlers,
  preselectedYouthWrestlerId = null,
}: Props) {
  const router = useRouter();
  const [youthWrestlerId, setYouthWrestlerId] = useState(
    () => preselectedYouthWrestlerId || youthWrestlers[0]?.id || ''
  );
  const [facilityId, setFacilityId] = useState<string>('any');
  const [sessionType, setSessionType] = useState<string>('private');
  const [preferredLocal, setPreferredLocal] = useState('');
  const [message, setMessage] = useState('');
  const [flexibilityNote, setFlexibilityNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!youthWrestlerId) {
      setError('Select a wrestler.');
      return;
    }

    const preferredDatetime =
      preferredLocal.trim() ? new Date(preferredLocal).toISOString() : null;
    const msg = message.trim();
    const flex = flexibilityNote.trim();

    if (!msg && !preferredDatetime && !flex) {
      setError('Add a preferred date and time, a message, or when you are flexible.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/parent-session-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: athlete.id,
          youthWrestlerId,
          facilityId: facilityId === 'any' ? null : facilityId,
          sessionType: sessionType === 'any' ? null : sessionType,
          preferredDatetime,
          message: msg || null,
          flexibilityNote: flex || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      router.push('/session-requests?submitted=1');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (youthWrestlers.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-lg">
        <div className="mb-4">
          <BackLink fallbackHref={`/book/${athlete.id}`} label="Back to booking" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Add a wrestler first</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need at least one youth wrestler on your account to request a session.
            </p>
            <Button asChild className="w-full">
              <Link href={`/wrestlers/add?redirect=${encodeURIComponent(`/book/${athlete.id}/request`)}`}>
                Add wrestler
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-lg">
      <div className="mb-4">
        <BackLink fallbackHref={`/book/${athlete.id}`} label="Back to booking" />
      </div>

      <div className="flex items-center gap-4 mb-6">
        <ProfileImage
          src={athlete.photo_url}
          alt={`${athlete.first_name} ${athlete.last_name}`}
          focusX={athlete.photo_focus_x}
          focusY={athlete.photo_focus_y}
          className="w-14 h-14 shrink-0"
          fallbackIconClassName="h-7 w-7 text-muted-foreground"
        />
        <div>
          <h1 className="text-xl font-bold">Request a session</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <SchoolLogo school={athlete.school} size="sm" />
            {athlete.first_name} {athlete.last_name}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              The coach will see this in My sessions → Requests. They can approve or decline and add a note.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="yw">Wrestler</Label>
              <Select value={youthWrestlerId} onValueChange={setYouthWrestlerId}>
                <SelectTrigger id="yw" className="min-h-[44px]">
                  <SelectValue placeholder="Select wrestler" />
                </SelectTrigger>
                <SelectContent>
                  {youthWrestlers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.first_name} {w.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stype">Session type</Label>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger id="stype" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">No preference</SelectItem>
                  <SelectItem value="private">Private (1:1)</SelectItem>
                  <SelectItem value="partner">Partner (up to 3 athletes)</SelectItem>
                  <SelectItem value="small_group">Small group</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fac">Facility (optional)</Label>
              <Select value={facilityId} onValueChange={setFacilityId}>
                <SelectTrigger id="fac" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">No preference</SelectItem>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="when">Preferred date &amp; time (optional)</Label>
              <input
                id="when"
                type="datetime-local"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={preferredLocal}
                onChange={(e) => setPreferredLocal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank if you are only describing flexibility below.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="msg">Message</Label>
              <Textarea
                id="msg"
                rows={4}
                placeholder="What you are looking for (goals, experience level, etc.)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-y min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="flex">Scheduling flexibility</Label>
              <Textarea
                id="flex"
                rows={2}
                placeholder="e.g. weekday evenings, or any time next week"
                value={flexibilityNote}
                onChange={(e) => setFlexibilityNote(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full min-h-[44px]" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send request'
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
