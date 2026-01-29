import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Edit, Calendar, User, School, Target, Heart, Award } from 'lucide-react';

export default async function YouthWrestlerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  
  if (!tenant) {
    redirect('/404');
  }

  const tenantSlug = tenant.slug;
  const supabase = await createClient(tenantSlug);
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Check user role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'parent') {
    if (userData?.role === 'athlete') {
      redirect('/dashboard');
    } else if (userData?.role === 'admin') {
      redirect('/admin');
    }
  }

  // Get youth wrestler
  const { data: youthWrestler, error } = await supabase
    .from('youth_wrestlers')
    .select('*')
    .eq('id', id)
    .eq('parent_id', user.id)
    .single();

  if (error || !youthWrestler) {
    redirect('/dashboard');
  }

  // Get sessions for this youth wrestler
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, athletes(first_name, last_name, photo_url), facilities(name)')
    .eq('youth_wrestler_id', id)
    .order('scheduled_datetime', { ascending: false });

  const upcomingSessions = sessions?.filter(
    (s: any) => s.status === 'scheduled' && new Date(s.scheduled_datetime) >= new Date()
  ) || [];

  const pastSessions = sessions?.filter(
    (s: any) => s.status === 'completed' || new Date(s.scheduled_datetime) < new Date()
  ) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Link>

      {/* Profile Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            {youthWrestler.photo_url ? (
              <img
                src={youthWrestler.photo_url}
                alt={`${youthWrestler.first_name} ${youthWrestler.last_name}`}
                className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-4 border-primary/20">
                <User className="h-16 w-16 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-3xl font-bold">
                  {youthWrestler.first_name} {youthWrestler.last_name}
                </h1>
                <Link href={`/wrestlers/${id}/edit`}>
                  <Button variant="outline" size="icon">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                {youthWrestler.age && <span>{youthWrestler.age} years old</span>}
                {youthWrestler.skill_level && (
                  <span className="capitalize">{youthWrestler.skill_level}</span>
                )}
                {youthWrestler.weight_class && <span>{youthWrestler.weight_class}</span>}
              </div>
              <Link href={`/browse?youthWrestlerId=${id}`}>
                <Button variant="premium">
                  <Calendar className="h-4 w-4 mr-2" />
                  Find an Elite Wrestler for {youthWrestler.first_name}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* School Info */}
        {(youthWrestler.school || youthWrestler.grade) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" />
                School Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {youthWrestler.school && (
                <p className="font-medium mb-1">{youthWrestler.school}</p>
              )}
              {youthWrestler.grade && (
                <p className="text-sm text-muted-foreground">Grade {youthWrestler.grade}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Wrestling Experience */}
        {youthWrestler.wrestling_experience && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Experience
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{youthWrestler.wrestling_experience}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Goals */}
      {youthWrestler.goals && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{youthWrestler.goals}</p>
          </CardContent>
        </Card>
      )}

      {/* Medical Notes */}
      {youthWrestler.medical_notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Medical Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{youthWrestler.medical_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
            <CardDescription>
              {upcomingSessions.length} scheduled session{upcomingSessions.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingSessions.map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {new Date(session.scheduled_datetime).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(session.scheduled_datetime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' • '}
                      {session.athletes?.first_name} {session.athletes?.last_name}
                      {' • '}
                      {session.facilities?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${Number(session.total_price).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{session.session_type}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      {pastSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Session History</CardTitle>
            <CardDescription>
              {pastSessions.length} past session{pastSessions.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pastSessions.slice(0, 10).map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {new Date(session.scheduled_datetime).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {session.athletes?.first_name} {session.athletes?.last_name}
                      {' • '}
                      {session.facilities?.name}
                      {' • '}
                      <span className="capitalize">{session.status}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${Number(session.total_price).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{session.session_type}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sessions?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No sessions yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Book a session to get started with private lessons.
            </p>
            <Link href={`/browse?youthWrestlerId=${id}`}>
              <Button>
                <Calendar className="h-4 w-4 mr-2" />
                Book First Session
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

