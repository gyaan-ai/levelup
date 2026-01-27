'use client';

import { useState } from 'react';
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
import { User, Calendar, MapPin, X } from 'lucide-react';
import { format } from 'date-fns';

interface SessionItem {
  id: string;
  scheduled_datetime: string;
  current_participants?: number;
  max_participants?: number;
  price_per_participant?: number;
  athletes?: unknown;
  facilities?: unknown;
  session_participants?: Array<{ youth_wrestlers?: unknown }>;
}

interface YouthWrestlerItem {
  id: string;
  first_name: string;
  last_name: string;
  age?: number;
  weight_class?: string;
  skill_level?: string;
}

interface PartnerSessionsClientProps {
  initialSessions: SessionItem[];
  youthWrestlers: YouthWrestlerItem[];
}

export function PartnerSessionsClient({
  initialSessions,
  youthWrestlers,
}: PartnerSessionsClientProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [requestingSessionId, setRequestingSessionId] = useState<string | null>(null);
  const [selectedWrestlerId, setSelectedWrestlerId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const handleRequest = (sessionId: string) => {
    setRequestingSessionId(sessionId);
    setSelectedWrestlerId('');
    setMessage('');
  };

  const handleSubmit = async () => {
    if (!requestingSessionId || !selectedWrestlerId) {
      alert('Please select a youth wrestler.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/session-join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: requestingSessionId,
          youthWrestlerId: selectedWrestlerId,
          message: message || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setRequestingSessionId(null);
      setSelectedWrestlerId('');
      setMessage('');
      alert('Join request sent! The session host will be notified.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const trainingWith = (s: SessionItem) => {
    const raw = s.session_participants?.[0]?.youth_wrestlers;
    const first = (Array.isArray(raw) ? raw[0] : raw) as { first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string } | null | undefined;
    if (!first) return null;
    const parts = [`${first.first_name ?? ''} ${first.last_name ?? ''}`.trim()];
    if (first.age != null) parts.push(`${first.age} yrs`);
    if (first.weight_class) parts.push(`${first.weight_class} lbs`);
    if (first.skill_level) parts.push(String(first.skill_level).charAt(0).toUpperCase() + String(first.skill_level).slice(1));
    return parts.join(', ');
  };

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No open partner sessions right now.</p>
          <p className="text-sm text-muted-foreground mt-2">Check back later or book your own partner session and invite someone.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {requestingSessionId && (
        <Card className="border-levelup-primary/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Request to Join Session</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => { setRequestingSessionId(null); setSelectedWrestlerId(''); setMessage(''); }}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Your wrestler</Label>
              <Select value={selectedWrestlerId} onValueChange={setSelectedWrestlerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose wrestler" />
                </SelectTrigger>
                <SelectContent>
                  {youthWrestlers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.first_name} {w.last_name}
                      {w.age != null ? ` (${w.age} yrs)` : ''}
                      {w.weight_class ? ` — ${w.weight_class} lbs` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="msg">Tell them about your wrestler (optional)</Label>
              <Textarea
                id="msg"
                placeholder="e.g. experience level, goals..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setRequestingSessionId(null); setSelectedWrestlerId(''); setMessage(''); }}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={loading || !selectedWrestlerId}>
                {loading ? 'Sending…' : 'Send Request'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((s) => {
          const athlete = (Array.isArray(s.athletes) ? s.athletes[0] : s.athletes) as { first_name?: string; last_name?: string; school?: string; photo_url?: string } | null | undefined;
          const facility = (Array.isArray(s.facilities) ? s.facilities[0] : s.facilities) as { name?: string; address?: string } | null | undefined;
          const dt = s.scheduled_datetime ? new Date(s.scheduled_datetime) : null;
          const price = s.price_per_participant ?? 40;
          return (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  {athlete?.photo_url ? (
                    <img src={athlete.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{athlete?.first_name} {athlete?.last_name}</p>
                    <p className="text-xs text-muted-foreground">{athlete?.school}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {dt && (
                  <p className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    {format(dt, 'EEEE, MMM d')} at {format(dt, 'h:mm a')}
                  </p>
                )}
                {facility && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {facility.name}
                  </p>
                )}
                {trainingWith(s) && (
                  <p className="text-sm">
                    <span className="font-medium">Training with:</span> {trainingWith(s)}
                  </p>
                )}
                <p className="font-bold">${Number(price).toFixed(2)}</p>
                <Button onClick={() => handleRequest(s.id)} className="w-full mt-2">
                  Request to Join
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
