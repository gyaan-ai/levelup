import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { JoinSessionClient } from './join-session-client';

export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) notFound();

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*, athletes(id, first_name, last_name, school, photo_url), facilities(id, name, address)')
    .eq('partner_invite_code', code.toUpperCase())
    .single();

  if (error || !session) notFound();

  const currentParticipants = (session as { current_participants?: number }).current_participants ?? 1;
  const maxParticipants = (session as { max_participants?: number }).max_participants ?? 2;
  const isFull = currentParticipants >= maxParticipants;

  const { data: participants } = await supabase
    .from('session_participants')
    .select('*, youth_wrestlers(id, first_name, last_name, age, weight_class, skill_level)')
    .eq('session_id', session.id);

  const athlete = session.athletes as { id: string; first_name: string; last_name: string; school: string; photo_url?: string } | null;
  const facility = session.facilities as { id: string; name: string; address?: string } | null;
  const scheduledAt = session.scheduled_datetime ? new Date(session.scheduled_datetime) : null;
  const dateTime = scheduledAt ? `${format(scheduledAt, 'EEEE, MMMM d, yyyy')} at ${format(scheduledAt, 'h:mm a')}` : '';
  const firstYouth = participants?.[0]?.youth_wrestlers as { first_name?: string; last_name?: string; age?: number; weight_class?: string; skill_level?: string } | null;
  const trainingWith = firstYouth
    ? `${firstYouth.first_name ?? ''} ${firstYouth.last_name ?? ''}`.trim() +
      (firstYouth.age != null ? ` (${firstYouth.age} yrs)` : '') +
      (firstYouth.weight_class ? `, ${firstYouth.weight_class} lbs` : '') +
      (firstYouth.skill_level ? `, ${String(firstYouth.skill_level).charAt(0).toUpperCase() + String(firstYouth.skill_level).slice(1)}` : '')
    : '';

  const pricePerParticipant = (session as { price_per_participant?: number }).price_per_participant ?? 40;

  let youthWrestlers: Array<{ id: string; first_name: string; last_name: string; age?: number; weight_class?: string; skill_level?: string }> = [];
  if (user && !isFull) {
    const { data: yw } = await supabase
      .from('youth_wrestlers')
      .select('id, first_name, last_name, age, weight_class, skill_level')
      .eq('parent_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });
    youthWrestlers = (yw ?? []) as typeof youthWrestlers;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>
            {isFull ? 'This session is already full' : 'Join this partner session'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isFull
              ? 'The session you were invited to has reached the maximum number of participants.'
              : 'Complete the form below to request to join.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFull ? (
            <Button asChild>
              <Link href="/browse">Browse other sessions</Link>
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-4">
                {athlete?.photo_url ? (
                  <img src={athlete.photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-semibold">{athlete?.first_name} {athlete?.last_name}</p>
                  <p className="text-sm text-muted-foreground">{athlete?.school}</p>
                </div>
              </div>
              <p className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                {dateTime}
              </p>
              {facility && (
                <p className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  {facility.name}
                  {facility.address && ` — ${facility.address}`}
                </p>
              )}
              {trainingWith && (
                <p className="text-sm">
                  <span className="font-medium">Training with:</span> {trainingWith}
                </p>
              )}
              <p className="text-lg font-bold">${Number(pricePerParticipant).toFixed(2)} to join</p>

              {user ? (
                <JoinSessionClient
                  sessionId={session.id}
                  code={code}
                  pricePerParticipant={pricePerParticipant}
                  youthWrestlers={youthWrestlers}
                />
              ) : (
                <div className="space-y-2 pt-2">
                  <p className="text-sm text-muted-foreground">Sign up or log in to join this session.</p>
                  <div className="flex gap-2">
                    <Button asChild variant="outline">
                      <Link href={`/login?redirect=/join/${code}`}>Log in</Link>
                    </Button>
                    <Button asChild>
                      <Link href={`/signup?redirect=/join/${code}`}>Sign up</Link>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
