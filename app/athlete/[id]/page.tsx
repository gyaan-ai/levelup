import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Star, User, MapPin, Award, Shield, CheckCircle } from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';
import { CoachSessionBadge } from '@/components/coach-session-badge';
import { FollowCoachButton } from '@/components/follow-coach-button';

const SCHOOL_COLORS: Record<string, { bg: string; text: string }> = {
  'UNC': { bg: 'bg-blue-600', text: 'text-white' },
  'NC State': { bg: 'bg-red-600', text: 'text-white' },
  'NCSU': { bg: 'bg-red-600', text: 'text-white' },
  'North Carolina State': { bg: 'bg-red-600', text: 'text-white' },
};

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  
  if (!tenant) {
    notFound();
  }

  const tenantSlug = tenant.slug;
  const supabase = await createClient(tenantSlug);
  
  // Fetch athlete with facility join
  const { data: athlete, error: athleteError } = await supabase
    .from('athletes')
    .select('*, facilities(name, address, school)')
    .eq('id', id)
    .single();

  // If athlete not found or not active, show 404
  if (athleteError || !athlete || !athlete.active) {
    notFound();
  }

  // Calculate total sessions from sessions table
  const { count: totalSessionsCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('athlete_id', id);

  const totalSessions = totalSessionsCount || athlete.total_sessions || 0;

  // Check certification status
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isSafeSportCertified = athlete.safesport_expiration
    ? new Date(athlete.safesport_expiration) > today
    : false;

  const isBackgroundChecked = athlete.background_check_expiration
    ? new Date(athlete.background_check_expiration) > today
    : false;

  const isUSAWrestlingMember = athlete.usa_wrestling_expiration
    ? new Date(athlete.usa_wrestling_expiration) > today
    : false;

  const isCPRCertified = athlete.cpr_expiration
    ? new Date(athlete.cpr_expiration) > today
    : false;

  // Parse credentials JSONB
  const credentials = athlete.credentials || {};
  const credentialsList = Array.isArray(credentials)
    ? credentials
    : typeof credentials === 'object' && credentials !== null
    ? Object.entries(credentials).map(([key, value]) => {
        // Handle different credential formats
        if (typeof value === 'string') {
          return value;
        }
        if (typeof value === 'object' && value !== null && 'title' in value) {
          return (value as any).title || key;
        }
        return key;
      })
    : [];

  const schoolColor = SCHOOL_COLORS[athlete.school] || { bg: 'bg-gray-500', text: 'text-white' };
  const rating = (athlete.average_rating ?? 0) > 0 ? (athlete.average_rating ?? 0).toFixed(1) : 'New';
  const facility = athlete.facilities as any;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link 
        href="/browse" 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Browse
      </Link>

      {/* Hero Section */}
      <Card className="mb-6">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Photo */}
            <div className="flex-shrink-0">
              {athlete.photo_url ? (
                <img
                  src={athlete.photo_url}
                  alt={`${athlete.first_name} ${athlete.last_name}`}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-primary/20"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-muted flex items-center justify-center border-4 border-primary/20">
                  <User className="h-16 w-16 md:h-20 md:w-20 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Name and Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">
                {athlete.first_name} {athlete.last_name}
              </h1>
              
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <CoachSessionBadge totalSessions={totalSessions} size="lg" />
                <SchoolLogo school={athlete.school} size="md" />
                <Badge className={`${schoolColor.bg} ${schoolColor.text}`}>
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

              {/* Star Rating */}
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 fill-accent text-accent" />
                <span className="text-lg font-semibold">{rating}</span>
                {totalSessions > 0 && (
                  <span className="text-muted-foreground">
                    ({totalSessions} {totalSessions === 1 ? 'session' : 'sessions'})
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

              {/* Book + Follow */}
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/book/${athlete.id}`}>
                  <Button
                    size="lg"
                    variant="premium"
                    className="w-full md:w-auto"
                  >
                    Book a Session with {athlete.first_name} →
                  </Button>
                </Link>
                <FollowCoachButton coachId={athlete.id} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Credentials Section */}
      <Card className="mb-6">
        <CardHeader>
            <CardTitle>Wrestling Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {credentialsList.length > 0 ? (
            <ul className="space-y-2">
              {credentialsList.map((credential, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Award className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{String(credential)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No achievements listed yet</p>
          )}
        </CardContent>
      </Card>

      {/* Training Location Section */}
      {facility && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Training Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="font-semibold text-lg">{facility.name}</p>
              {facility.address && (
                <p className="text-muted-foreground">{facility.address}</p>
              )}
              {facility.school && (
                <p className="text-sm text-muted-foreground">{facility.school}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

