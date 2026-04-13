import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BackLink } from '@/components/back-link';
import { ProfileImage } from '@/components/profile-image';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { SchoolLogo } from '@/components/school-logo';
import { formatEST } from '@/lib/format-date';
import { getEffectiveFilledCount } from '@/lib/sessions';
import { Calendar, MapPin, Users, ChevronRight, Lock, Share2 } from 'lucide-react';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SessionRow = {
  id: string;
  scheduled_datetime: string;
  session_type?: string | null;
  session_mode?: string | null;
  join_policy?: string | null;
  focus_area?: string | null;
  current_participants?: number | null;
  max_participants?: number | null;
  price_per_participant?: number | null;
  partner_invite_code?: string | null;
  facilities?: { name?: string } | { name?: string }[] | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) return { title: 'Coach sessions' };
  const admin = createAdminClient(tenant.slug);
  const { data: a } = await admin
    .from('athletes')
    .select('first_name, last_name')
    .eq('id', id)
    .maybeSingle();
  const name = a
    ? [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || 'Coach'
    : 'Coach';
  return {
    title: `${name} — sessions | The Guild`,
    description: `See upcoming training sessions with ${name}.`,
  };
}

export default async function CoachPublicSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) notFound();

  if (!id?.trim()) notFound();

  const supabase = await createClient(tenant.slug);
  const admin = createAdminClient(tenant.slug);

  const { data: athleteRow } = await supabase
    .from('athletes')
    .select('id, first_name, last_name, school, photo_url, photo_focus_x, photo_focus_y, active')
    .eq('id', id)
    .maybeSingle();

  if (!athleteRow || !athleteRow.active) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Coach not found</CardTitle>
            <p className="text-sm text-muted-foreground">
              This link may be outdated or the coach profile is unavailable.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/browse">Browse coaches</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const coachName = [athleteRow.first_name, athleteRow.last_name].filter(Boolean).join(' ').trim() || 'Coach';
  const nowIso = new Date().toISOString();

  const { data: sessionRows } = await admin
    .from('sessions')
    .select(
      `
      id,
      scheduled_datetime,
      session_type,
      session_mode,
      join_policy,
      focus_area,
      current_participants,
      max_participants,
      price_per_participant,
      partner_invite_code,
      facilities:facility_id(name)
    `
    )
    .eq('athlete_id', id)
    .in('status', ['scheduled', 'pending_payment'])
    .gte('scheduled_datetime', nowIso)
    .order('scheduled_datetime', { ascending: true })
    .limit(200);

  const sessions = (sessionRows ?? []) as SessionRow[];

  /** Optional: load participant counts for fuller sessions (same as browse). */
  const sessionIds = sessions.map((s) => s.id);
  const filledBySession = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: parts } = await admin
      .from('session_participants')
      .select('session_id')
      .in('session_id', sessionIds);
    for (const p of parts ?? []) {
      const sid = (p as { session_id: string }).session_id;
      filledBySession.set(sid, (filledBySession.get(sid) ?? 0) + 1);
    }
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (host.startsWith('localhost') ? `http://${host}` : `https://${host}`);
  const shareUrl = `${baseUrl}/coach/${id}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl pb-16">
      <div className="mb-6">
        <BackLink fallbackHref="/browse" label="Browse coaches" />
      </div>

      <Card className="mb-8 border-border/80">
        <CardContent className="p-6 flex flex-col sm:flex-row gap-5 items-start">
          <ProfileImage
            src={athleteRow.photo_url}
            alt={coachName}
            focusX={athleteRow.photo_focus_x}
            focusY={athleteRow.photo_focus_y}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-2 border-accent/25 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-foreground">{coachName}</h1>
            {athleteRow.school && (
              <div className="flex items-center gap-2 mt-2">
                <SchoolLogo school={athleteRow.school} size="sm" />
                <span className="text-muted-foreground">{athleteRow.school}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-3">
              Upcoming sessions — share this page for a single link to everything listed below (public, invite, and
              private openings).
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button asChild variant="premium" size="sm">
                <Link href={`/athlete/${id}`}>Full coach profile</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/login?redirect=${encodeURIComponent(`/book/${id}`)}`}>Sign in to book</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 mb-6 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 min-w-0">
          <Share2 className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-foreground shrink-0">Share weekly:</span>
        </div>
        <code className="break-all text-[11px] sm:text-xs bg-background/80 px-2 py-1 rounded border border-border/60">
          {shareUrl}
        </code>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">All upcoming sessions</h2>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p>No upcoming sessions scheduled yet.</p>
            <p className="text-sm mt-2">
              Ask the coach for a session link, or{' '}
              <Link href={`/login?redirect=${encodeURIComponent(`/book/${id}`)}`} className="text-accent underline">
                sign in to request a time
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const policy = (s.join_policy ?? 'public') as string;
            const dt = new Date(s.scheduled_datetime);
            const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
            const max = s.max_participants ?? 1;
            const listedOverride = filledBySession.get(s.id);
            const filled = getEffectiveFilledCount(
              {
                current_participants: s.current_participants,
                max_participants: max,
              },
              listedOverride
            );
            const openSlots = Math.max(0, max - filled);
            const isFull = max > 0 && openSlots <= 0;
            const price = s.price_per_participant;
            const code = s.partner_invite_code?.trim();

            let cta: { href: string; label: string; external?: boolean };
            if (policy === 'invite_only' && code) {
              cta = { href: `/join/${code.toUpperCase()}`, label: 'Open invite link', external: false };
            } else if (policy === 'public') {
              cta = {
                href: `/login?redirect=${encodeURIComponent(`/sessions/${s.id}/register`)}`,
                label: 'Sign in to register',
              };
            } else {
              cta = {
                href: `/login?redirect=${encodeURIComponent(`/book/${id}`)}`,
                label: 'Sign in to book',
              };
            }

            return (
              <li key={s.id}>
                <Card className={`overflow-hidden ${isFull ? 'opacity-75' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <SessionTypeBadge sessionType={s.session_type ?? null} sessionMode={s.session_mode ?? null} />
                        {policy === 'private' && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Private
                          </Badge>
                        )}
                        {policy === 'invite_only' && (
                          <Badge variant="secondary" className="text-xs">
                            Invite
                          </Badge>
                        )}
                        {policy === 'public' && (
                          <Badge variant="outline" className="text-xs">
                            Public
                          </Badge>
                        )}
                        {s.focus_area && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {s.focus_area}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {formatEST(dt, 'EEE, MMM d, yyyy')} · {formatEST(dt, 'h:mm a')}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
                          {fac?.name && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {fac.name}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {isFull ? 'Full' : `${openSlots} spot${openSlots !== 1 ? 's' : ''} left`}
                          </span>
                          {price != null && Number(price) > 0 && (
                            <span className="text-foreground font-medium">${Number(price)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {isFull ? (
                          <Button size="sm" variant="secondary" disabled>
                            Full
                          </Button>
                        ) : (
                          <Button size="sm" variant="default" className="bg-[#D4AF37] text-black hover:bg-[#c4a030]" asChild>
                            <Link href={cta.href}>
                              {cta.label}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Link>
                          </Button>
                        )}
                        {policy === 'invite_only' && !code && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 self-center">
                            Ask the coach for their invite link.
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground mt-8 text-center">
        Booking may require a free parent account. Invite links work without browsing the full catalog first.
      </p>
    </div>
  );
}
