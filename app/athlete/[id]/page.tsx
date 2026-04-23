import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Star, User, MapPin, Award, Shield, CheckCircle, DollarSign, Pencil, Calendar, Clock, Users, ChevronRight } from 'lucide-react';
import { BackLink } from '@/components/back-link';
import { formatEST } from '@/lib/format-date';
import { SessionTypeBadge } from '@/components/session-type-badge';
import { SchoolLogo } from '@/components/school-logo';
import { CoachSessionBadge } from '@/components/coach-session-badge';
import { FollowCoachButton } from '@/components/follow-coach-button';
import { DeleteAthleteProfileButton } from '@/components/delete-athlete-profile-button';
import { ProfileImage } from '@/components/profile-image';
import { isBackgroundCheckValidForDisplay, isSafeSportValidForDisplay } from '@/lib/athletes';
import { getSchoolBadgeColors, schoolBadgeClassName } from '@/lib/school-logos';
import { summarizeWeeklyAvailability, type WeeklyAvailabilityRow } from '@/lib/availability';
import { COACH_PROFILE_PUBLIC_RATE_ROWS, getCoachDisplayedParentRates } from '@/lib/coach-session-pricing';
import { ContactInfoRow } from '@/components/contact-info-row';
import { hasMinPhoneDigits } from '@/lib/phone';

function CoachProfileUnavailable() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Coach profile unavailable</CardTitle>
          <p className="text-muted-foreground">
            This coach&apos;s profile is no longer available. They may have deactivated their account or the link may be outdated.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/bookings">
            <Button variant="default" className="w-full sm:w-auto">
              My bookings
            </Button>
          </Link>
          <Link href="/browse">
            <Button variant="outline" className="w-full sm:w-auto">
              Browse coaches
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function AthleteProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ youthWrestlerId?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const youthWrestlerId = sp.youthWrestlerId ?? undefined;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  
  if (!tenant) {
    notFound();
  }

  const tenantSlug = tenant.slug;
  const supabase = await createClient(tenantSlug);

  // Invalid id (e.g. /athlete/undefined or empty) -> friendly fallback instead of 404
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return <CoachProfileUnavailable />;
  }

  // Fetch athlete first without join to avoid RLS/join issues
  const { data: athleteRow, error: athleteError } = await supabase
    .from('athletes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (athleteError) {
    console.error('[Athlete profile] fetch error:', athleteError);
    notFound();
  }
  // Coach missing or deactivated: show friendly message instead of 404
  if (!athleteRow || !athleteRow.active) {
    return <CoachProfileUnavailable />;
  }

  // Fetch facility separately so public profile doesn't depend on join RLS
  let facility: { name: string; address?: string; school?: string } | null = null;
  if (athleteRow.facility_id) {
    const { data: fac } = await supabase
      .from('facilities')
      .select('name, address, school')
      .eq('id', athleteRow.facility_id)
      .maybeSingle();
    facility = fac;
  }
  const athlete = { ...athleteRow, facilities: facility };

  // Use athlete.total_sessions (completed only, maintained by trigger) for badge and display
  const completedSessions = athlete.total_sessions ?? 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check certification status (SafeSport uses true expiration; background uses attestation + completion date — see lib/athletes)
  const isSafeSportCertified = isSafeSportValidForDisplay(athlete);
  const isBackgroundChecked = isBackgroundCheckValidForDisplay(athlete);

  const isUSAWrestlingMember = athlete.usa_wrestling_expiration
    ? new Date(athlete.usa_wrestling_expiration) > today
    : false;

  const isCPRCertified = athlete.cpr_expiration
    ? new Date(athlete.cpr_expiration) > today
    : false;

  const schoolColor = getSchoolBadgeColors(athlete.school);

  const { data: reviewsRows } = await supabase
    .from('reviews_anonymous')
    .select('id, rating, comment, tags, created_at')
    .eq('athlete_id', id)
    .order('created_at', { ascending: false });
  const reviews = reviewsRows ?? [];
  const reviewCount = reviews.length;
  /** Hero rating must match listed reviews — derive from rows, not athletes.average_rating (can be stale). */
  const averageFromReviews =
    reviewCount > 0 ? reviews.reduce((sum, r) => sum + Number((r as { rating: number }).rating), 0) / reviewCount : 0;
  const rating = averageFromReviews > 0 ? averageFromReviews.toFixed(1) : 'New';

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userData } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null };
  const isParent = userData?.role === 'parent';
  const isAdmin = userData?.role === 'admin';
  const isOwnProfile = !!user && user.id === id && userData?.role === 'coach';
  const canDelete = isAdmin || isOwnProfile;
  /** Parents and admins viewing a coach — book / message / request (not your own profile). */
  const canInteractAsParentOrAdmin = (isParent || isAdmin) && !isOwnProfile;
  const bookHref = youthWrestlerId
    ? `/book/${athlete.id}?youthWrestlerId=${encodeURIComponent(youthWrestlerId)}`
    : `/book/${athlete.id}`;
  const athleteName = `${athlete.first_name} ${athlete.last_name}`.trim() || 'This coach';

  const { data: weeklyAvailRows } = await supabase
    .from('athlete_availability')
    .select('day_of_week, start_time, end_time')
    .eq('athlete_id', id);
  const availabilitySummaryLines = summarizeWeeklyAvailability((weeklyAvailRows ?? []) as WeeklyAvailabilityRow[]);

  // Fetch upcoming public sessions for this coach
  const admin = createAdminClient(tenantSlug);
  const nowISO = new Date().toISOString();
  const { data: upcomingSessions } = await admin
    .from('sessions')
    .select(`
      id,
      scheduled_datetime,
      session_type,
      session_mode,
      focus_area,
      current_participants,
      max_participants,
      price_per_participant,
      facilities(name)
    `)
    .eq('athlete_id', id)
    .in('status', ['scheduled', 'pending_payment'])
    .in('join_policy', ['public'])
    .gte('scheduled_datetime', nowISO)
    .order('scheduled_datetime', { ascending: true })
    .limit(5);

  let coachPhoneForContact: string | null = null;
  if (canInteractAsParentOrAdmin) {
    const { data: coachUserRow } = await admin.from('users').select('phone').eq('id', id).maybeSingle();
    const raw = (coachUserRow as { phone?: string | null } | null)?.phone;
    coachPhoneForContact = raw && hasMinPhoneDigits(raw) ? raw : null;
  }

  const displayedParentRates = await getCoachDisplayedParentRates(admin, id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <BackLink fallbackHref="/browse" label="Back to Browse" />
      </div>

      {/* Hero Section */}
      <Card className="mb-6 relative">
        <CardContent className="p-8">
          <div className="absolute top-6 right-6">
            <FollowCoachButton coachId={athlete.id} />
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Photo */}
            <div className="flex-shrink-0">
              <ProfileImage
                src={athlete.photo_url}
                alt={`${athlete.first_name} ${athlete.last_name}`}
                focusX={athlete.photo_focus_x}
                focusY={athlete.photo_focus_y}
                className="w-32 h-32 md:w-40 md:h-40 border-4 border-accent/30"
                fallbackIconClassName="h-16 w-16 md:h-20 md:w-20 text-muted-foreground"
              />
            </div>

            {/* Name and Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">
                {athlete.first_name} {athlete.last_name}
              </h1>
              
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <CoachSessionBadge totalSessions={completedSessions} size="lg" />
                <SchoolLogo school={athlete.school} size="md" />
                <Badge className={schoolBadgeClassName(schoolColor)}>
                  {athlete.school}
                </Badge>
                {athlete.year && (
                  <span className="text-muted-foreground">{athlete.year}</span>
                )}
                {athlete.weight_class && (
                  <span className="text-muted-foreground">
                    {athlete.weight_class} lbs
                  </span>
                )}
              </div>

              {/* Rating summary only; full stars + comments are below in "What parents say" */}
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 fill-accent text-accent" />
                <span className="text-lg font-semibold">{rating}</span>
                {reviewCount > 0 && (
                  <span className="text-muted-foreground">
                    ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                )}
                {completedSessions > 0 && reviewCount === 0 && (
                  <span className="text-muted-foreground">
                    ({completedSessions} {completedSessions === 1 ? 'session' : 'sessions'})
                  </span>
                )}
              </div>

              {/* Certification Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {isSafeSportCertified && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    SafeSport Certified
                  </Badge>
                )}
                {isBackgroundChecked && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-green-600" />
                    Background Checked
                  </Badge>
                )}
                {isUSAWrestlingMember && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Award className="h-3 w-3 text-green-600" />
                    USA Wrestling Member
                  </Badge>
                )}
                {isCPRCertified && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    CPR Certified
                  </Badge>
                )}
              </div>

              {/* Parents/admins: book. Coaches: edit own profile only (no admin shortcut here). */}
              <div className="flex flex-col gap-3 max-w-xl">
                <div className="flex flex-wrap items-center gap-3">
                  {canInteractAsParentOrAdmin && (
                    <Link href={bookHref}>
                      <Button size="lg" variant="premium" className="w-full sm:w-auto touch-manipulation">
                        Book with {athlete.first_name}
                      </Button>
                    </Link>
                  )}
                  {isOwnProfile && (
                    <Link href="/profile">
                      <Button size="lg" variant="outline" className="w-full sm:w-auto touch-manipulation">
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit profile
                      </Button>
                    </Link>
                  )}
                </div>
                {canInteractAsParentOrAdmin && (
                  <>
                    {coachPhoneForContact ? (
                      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 max-w-lg">
                        <ContactInfoRow label="Coach cell" name={athlete.first_name} phone={coachPhoneForContact} />
                        <p className="text-xs text-muted-foreground mt-2">
                          On your phone, use the message icon to open your texting app.
                        </p>
                      </div>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      <Link href={`/coach/${athlete.id}`} className="text-accent font-medium underline">
                        Open existing partner and small group sessions
                      </Link>
                      <span className="hidden sm:inline"> — share that page if someone needs your link.</span>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Sessions Section */}
      {(upcomingSessions ?? []).length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Sessions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Open sessions you can join
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(upcomingSessions ?? []).map((session) => {
                const s = session as {
                  id: string;
                  scheduled_datetime: string;
                  session_type?: string | null;
                  session_mode?: string | null;
                  focus_area?: string | null;
                  current_participants?: number | null;
                  max_participants?: number | null;
                  price_per_participant?: number | null;
                  facilities?: { name?: string } | { name?: string }[] | null;
                };
                const dt = new Date(s.scheduled_datetime);
                const fac = Array.isArray(s.facilities) ? s.facilities[0] : s.facilities;
                const current = s.current_participants ?? 0;
                const max = s.max_participants ?? 1;
                const openSlots = Math.max(0, max - current);
                const price = s.price_per_participant;
                return (
                  <Link key={s.id} href={`/coach/${athlete.id}`}>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <SessionTypeBadge sessionType={s.session_type ?? null} sessionMode={s.session_mode ?? null} />
                          {s.focus_area && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                              {s.focus_area}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-foreground">
                          {formatEST(dt, 'EEE, MMM d')} · {formatEST(dt, 'h:mm a')}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                          {fac?.name && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {fac.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {openSlots > 0 ? `${openSlots} spot${openSlots !== 1 ? 's' : ''} left` : 'Full'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        {price != null && price > 0 && (
                          <span className="text-lg font-bold text-foreground">${price}</span>
                        )}
                        <ChevronRight className="h-5 w-5 text-zinc-500" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <Link href={`/coach/${athlete.id}`}>
              <Button variant="outline" className="w-full mt-4">
                View all sessions (public link)
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* About Section */}
      {athlete.bio && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>About This Coach</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {athlete.bio}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Training Location Section */}
      {facility && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Training Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="font-semibold text-lg">{facility.name}</p>
              {facility.school && (
                <p className="text-sm text-muted-foreground">{facility.school}</p>
              )}
              {facility.address && (
                <p className="text-muted-foreground">{facility.address}</p>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  facility.address
                    ? `${facility.name}, ${facility.address}`
                    : `${facility.name}${facility.school ? ` ${facility.school}` : ''}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
              >
                <MapPin className="h-4 w-4" />
                Get directions (Google Maps)
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {availabilitySummaryLines.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Availability
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Typical hours for private or partner sessions (Eastern). Public small-group join-ins, if any, appear
              separately above.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-foreground">
              {availabilitySummaryLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Session types & rates
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Starting rates for this coach (from their rate card). Small group and partner are per participant; private
            is one session. You&apos;ll pick date and time when you book.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {COACH_PROFILE_PUBLIC_RATE_ROWS.map((row) => (
              <li
                key={row.sessionType}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0"
              >
                <div>
                  <p className="font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.sublabel}</p>
                </div>
                <p className="text-lg font-semibold shrink-0">${displayedParentRates[row.sessionType]}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* What parents say — ratings and comments (anonymous; no names shown) */}
      {reviews.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 fill-accent text-accent" />
              What parents say
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Feedback from parents after sessions
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-5">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-border last:border-0 pb-5 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i <= (r.rating ?? 0) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-muted-foreground text-sm leading-relaxed mt-1">&ldquo;{r.comment}&rdquo;</p>
                  )}
                  {r.tags && Array.isArray(r.tags) && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(r.tags as string[]).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Delete profile (admin, parent, or own profile) */}
      {canDelete && (
        <DeleteAthleteProfileButton
          athleteId={id}
          athleteName={athleteName}
          isOwnProfile={isOwnProfile}
        />
      )}
    </div>
  );
}

