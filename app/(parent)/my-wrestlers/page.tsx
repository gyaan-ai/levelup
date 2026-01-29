import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Edit, User, Calendar } from 'lucide-react';
import { YouthWrestler } from '@/types';

export default async function ParentDashboard() {
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

  // Get youth wrestlers
  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('*')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false });

  // Get upcoming sessions for all youth wrestlers
  const youthWrestlerIds = youthWrestlers?.map(yw => yw.id) || [];
  const { data: upcomingSessions } = youthWrestlerIds.length > 0
    ? await supabase
        .from('sessions')
        .select('*, youth_wrestlers(id, first_name, last_name)')
        .in('youth_wrestler_id', youthWrestlerIds)
        .eq('status', 'scheduled')
        .gte('scheduled_datetime', new Date().toISOString())
        .order('scheduled_datetime', { ascending: true })
        .limit(10)
    : { data: [] };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Youth Wrestlers</h1>
          <p className="text-muted-foreground">
            Manage profiles for your wrestlers
          </p>
        </div>
        <Link href="/wrestlers/add">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Youth Wrestler
          </Button>
        </Link>
      </div>

      {youthWrestlers && youthWrestlers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {youthWrestlers.map((wrestler: YouthWrestler) => {
            const wrestlerSessions = upcomingSessions?.filter(
              (s: any) => s.youth_wrestler_id === wrestler.id
            ) || [];

            return (
              <Card key={wrestler.id} className="overflow-hidden">
                <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/40">
                  {wrestler.photo_url ? (
                    <img
                      src={wrestler.photo_url}
                      alt={`${wrestler.first_name} ${wrestler.last_name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <User className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardHeader>
                  <CardTitle>
                    {wrestler.first_name} {wrestler.last_name}
                  </CardTitle>
                  <CardDescription>
                    {wrestler.age && `${wrestler.age} years old`}
                    {wrestler.skill_level && ` • ${wrestler.skill_level}`}
                    {wrestler.weight_class && ` • ${wrestler.weight_class}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {wrestler.school && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {wrestler.school}
                      {wrestler.grade && ` • Grade ${wrestler.grade}`}
                    </p>
                  )}

                  {wrestlerSessions.length > 0 && (
                    <div className="mb-4 p-2 bg-muted rounded-md">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">
                          {wrestlerSessions.length} upcoming session{wrestlerSessions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link href={`/wrestlers/${wrestler.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        View Profile
                      </Button>
                    </Link>
                    <Link href={`/wrestlers/${wrestler.id}/edit`}>
                      <Button variant="outline" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No youth wrestlers yet</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Add a profile for your youth wrestler to start booking sessions with college athletes.
            </p>
            <Link href="/wrestlers/add">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Youth Wrestler
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

