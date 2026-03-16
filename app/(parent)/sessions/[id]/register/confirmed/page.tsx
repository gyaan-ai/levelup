import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Calendar, MapPin } from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import { verifyRegisterConfirmationToken } from '@/lib/confirmation-token';
import { ProfileImage } from '@/components/profile-image';
import { SchoolLogo } from '@/components/school-logo';

export default async function SessionRegisterConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id: sessionId } = await params;
  const sp = await searchParams;
  const token = sp?.t?.trim();

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  // Allow viewing with valid post-payment token when returning from Stripe (even if auth cookie was lost)
  const tokenValid = !!token && verifyRegisterConfirmationToken(sessionId, token);

  if (!user && !tokenValid) {
    redirect(`/login?redirect=${encodeURIComponent(`/sessions/${sessionId}/register/confirmed`)}`);
  }

  const admin = createAdminClient(tenant.slug);
  const { data: session, error: sessionErr } = await admin
    .from('sessions')
    .select(`
      id,
      athlete_id,
      scheduled_datetime,
      athletes(id, first_name, last_name, school, photo_url, photo_focus_x, photo_focus_y),
      facilities(id, name, address)
    `)
    .eq('id', sessionId)
    .single();

  if (sessionErr || !session) notFound();

  type AthleteRow = { id: string; first_name?: string; last_name?: string; school?: string; photo_url?: string; photo_focus_x?: number; photo_focus_y?: number };
  const athletesRaw = session.athletes as unknown;
  const athlete: AthleteRow | null = Array.isArray(athletesRaw) ? (athletesRaw[0] as AthleteRow) ?? null : (athletesRaw as AthleteRow | null);
  const facilitiesRaw = session.facilities as unknown;
  const facility: { id: string; name?: string; address?: string } | null = Array.isArray(facilitiesRaw) ? (facilitiesRaw[0] as { id: string; name?: string; address?: string }) ?? null : (facilitiesRaw as { id: string; name?: string; address?: string } | null);
  const coachName = athlete
    ? `${athlete.first_name ?? ''} ${athlete.last_name ?? ''}`.trim() || 'Your coach'
    : 'Your coach';
  const scheduledAt = session.scheduled_datetime ? new Date(session.scheduled_datetime) : null;
  const dateTime = scheduledAt
    ? `${formatEST(scheduledAt, 'EEEE, MMMM d, yyyy')} at ${formatEST(scheduledAt, 'h:mm a')}`
    : '';

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle className="h-10 w-10 shrink-0" />
              <h1 className="text-2xl font-bold text-foreground">You&apos;re registered</h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Payment completed. Your wrestler is signed up for this session.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Coach photo + thank you — custom to this booking */}
          <div className="flex flex-col items-center text-center">
            <ProfileImage
              src={athlete?.photo_url}
              alt={coachName}
              focusX={athlete?.photo_focus_x}
              focusY={athlete?.photo_focus_y}
              className="w-24 h-24 border-2 border-accent/30"
              fallbackIconClassName="h-12 w-12 text-muted-foreground"
            />
            <p className="mt-3 font-semibold">{coachName}</p>
            {athlete?.school && (
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <SchoolLogo school={athlete.school} size="sm" />
                {athlete.school}
              </p>
            )}
            <p className="mt-2 text-foreground">
              Thank you! I look forward to seeing you on {dateTime || 'the scheduled date'}.
            </p>
          </div>

          {/* Date & location */}
          <div className="space-y-2 rounded-lg bg-muted/50 p-4">
            {dateTime && (
              <p className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 shrink-0" />
                {dateTime}
              </p>
            )}
            {facility && (
              <p className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {facility.name}
                  {facility.address && ` — ${facility.address}`}
                </span>
              </p>
            )}
          </div>

          <p className="text-sm text-muted-foreground text-center">
            You&apos;ll see this session in My bookings.
          </p>

          <div className="space-y-2 pt-2">
            {session.athlete_id && (
              <Button asChild className="w-full" size="lg">
                <Link href={`/training?tab=sessions&coach=${session.athlete_id}`}>
                  Book another with this coach
                </Link>
              </Button>
            )}
            <Button asChild variant={session.athlete_id ? 'outline' : 'default'} className="w-full" size="lg">
              <Link href="/training">Book another session</Link>
            </Button>
            <Button asChild variant="outline" className="w-full" size="lg">
              <Link href="/bookings">Done — Back to My bookings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
