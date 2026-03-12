'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, MapPin, Users } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { SchoolLogo } from '@/components/school-logo';
import {
  SessionStatusPill,
  ParticipantAvatars,
  getSessionAvailability,
  type ParticipantInfo,
} from '@/components/session-tile-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SmallGroupSession = {
  id: string;
  scheduled_datetime: string;
  session_type?: string;
  session_mode?: string;
  focus_area?: string | null;
  current_participants?: number;
  max_participants?: number;
  total_price?: number;
  parent_id?: string;
  athlete_id?: string;
  athletes?: { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string } | { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string }[];
  facilities?: { id: string; name?: string; address?: string } | { id: string; name?: string; address?: string }[];
  session_participants?: Array<{
    youth_wrestlers?: { id: string; first_name?: string; last_name?: string; photo_url?: string } | { id: string; first_name?: string; last_name?: string; photo_url?: string }[];
  }>;
};

export type PartnerSession = SmallGroupSession & {
  price_per_participant?: number;
  session_participants?: Array<{
    youth_wrestlers?: { id?: string; first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string; photo_url?: string } | { id?: string; first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string; photo_url?: string }[];
  }>;
};

type StatusFilter = 'all' | 'open' | 'filling' | 'full';

function matchesFilter(
  s: { current_participants?: number; max_participants?: number },
  filter: StatusFilter
): boolean {
  if (filter === 'all') return true;
  const current = s.current_participants ?? 0;
  const max = s.max_participants ?? 0;
  const status = getSessionAvailability(current, max);
  if (filter === 'open') return status === 'open';
  if (filter === 'filling') return status === 'filling';
  if (filter === 'full') return status === 'full';
  return true;
}

function participantsFromSession(s: SmallGroupSession | PartnerSession): ParticipantInfo[] {
  const parts = s.session_participants ?? [];
  const result: ParticipantInfo[] = [];
  for (const p of parts) {
    const yw = Array.isArray(p.youth_wrestlers) ? p.youth_wrestlers[0] : p.youth_wrestlers;
    if (!yw || !('id' in yw)) continue;
    const id = (yw as { id?: string }).id ?? '';
    if (!id) continue;
    result.push({
      id,
      first_name: (yw as { first_name?: string }).first_name ?? null,
      last_name: (yw as { last_name?: string }).last_name ?? null,
      photo_url: (yw as { photo_url?: string }).photo_url ?? null,
    });
  }
  return result;
}

export function SmallGroupSessionsClient({
  sessions,
  partnerSessions,
  userId,
}: {
  sessions: SmallGroupSession[];
  partnerSessions: PartnerSession[];
  userId: string;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredSessions = useMemo(
    () => sessions.filter((s) => matchesFilter(s, statusFilter)),
    [sessions, statusFilter]
  );
  const filteredPartner = useMemo(
    () => partnerSessions.filter((s) => matchesFilter(s, statusFilter)),
    [partnerSessions, statusFilter]
  );

  const isOwner = (s: { parent_id?: string; athlete_id?: string }) =>
    s.parent_id === userId || s.athlete_id === userId;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Box 1: Small group sessions */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Small group sessions
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Group sessions for this week and next. Session owner can approve join requests.
            </p>
          </div>
          {sessions.length > 0 && (
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="filling">Filling up</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No small group sessions scheduled for this period.</p>
              <Button asChild variant="outline">
                <Link href="/browse">Browse coaches</Link>
              </Button>
            </div>
          ) : filteredSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No sessions match the selected filter.</p>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((s) => {
                const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
                const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
                const participantList = participantsFromSession(s);
                const dt = new Date(s.scheduled_datetime);
                const current = s.current_participants ?? 0;
                const max = s.max_participants ?? 0;
                const openSlots = max - current;

                return (
                  <div key={s.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">
                        {formatEST(dt, 'EEEE, MMM d')} at {formatEST(dt, 'h:mm a')}
                      </p>
                      {isOwner(s) && (
                        <span className="text-xs font-normal text-accent bg-accent/20 px-2 py-0.5 rounded">You own</span>
                      )}
                      <SessionStatusPill current={current} max={max} />
                    </div>
                    {(s as SmallGroupSession).focus_area && (
                      <p className="text-xs font-medium text-accent">
                        {(s as SmallGroupSession).focus_area}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <ParticipantAvatars participants={participantList} maxShow={5} size="sm" />
                      <p className="text-sm flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {coach ? `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() : '—'}
                        {coach?.school && <SchoolLogo school={coach.school} size="sm" />}
                      </p>
                    </div>
                    {fac && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {fac.name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {current} / {max} participants
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {isOwner(s) && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/sessions/${s.id}/requests`}>Manage join requests</Link>
                        </Button>
                      )}
                      {!isOwner(s) && openSlots > 0 && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/sessions/${s.id}/request-join`}>Request to join</Link>
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/workspaces/from-session/${s.id}`}>Workspace</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Box 2: Open partner sessions */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Open partner sessions
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Someone is looking for a partner. Request to join; the session owner approves.
            </p>
          </div>
          {partnerSessions.length > 0 && (
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="filling">Filling up</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent>
          {partnerSessions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No open partner sessions right now.</p>
              <Button asChild variant="outline">
                <Link href="/partner-sessions">View partner sessions page</Link>
              </Button>
            </div>
          ) : filteredPartner.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No sessions match the selected filter.</p>
          ) : (
            <div className="space-y-4">
              {filteredPartner.map((s) => {
                const coach = Array.isArray(s.athletes) ? s.athletes[0] : s.athletes;
                const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
                const ywRel = s.session_participants?.[0]?.youth_wrestlers;
                const yw = Array.isArray(ywRel) ? ywRel[0] : ywRel;
                const withWho = yw ? [yw.first_name, yw.last_name].filter(Boolean).join(' ') : null;
                const participantList = participantsFromSession(s);
                const dt = new Date(s.scheduled_datetime);
                const current = s.current_participants ?? 0;
                const max = s.max_participants ?? 0;

                return (
                  <div key={s.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">
                        {formatEST(dt, 'EEEE, MMM d')} at {formatEST(dt, 'h:mm a')}
                      </p>
                      {isOwner(s) && (
                        <span className="text-xs font-normal text-accent bg-accent/20 px-2 py-0.5 rounded">You own</span>
                      )}
                      <SessionStatusPill current={current} max={max} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ParticipantAvatars participants={participantList} maxShow={5} size="sm" />
                      <p className="text-sm flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {coach ? `${(coach as { first_name?: string; last_name?: string }).first_name ?? ''} ${(coach as { first_name?: string; last_name?: string }).last_name ?? ''}`.trim() : '—'}
                        {coach?.school && <SchoolLogo school={(coach as { school?: string }).school ?? ''} size="sm" />}
                      </p>
                    </div>
                    {withWho && (
                      <p className="text-xs text-muted-foreground">Looking for partner · with {withWho}</p>
                    )}
                    {fac && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {(fac as { name?: string }).name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      ${Number(s.price_per_participant ?? s.total_price ?? 0).toFixed(2)} per person
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {isOwner(s) && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/sessions/${s.id}/requests`}>Manage join requests</Link>
                        </Button>
                      )}
                      {!isOwner(s) && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/sessions/${s.id}/request-join`}>Request to join</Link>
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/workspaces/from-session/${s.id}`}>Workspace</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
