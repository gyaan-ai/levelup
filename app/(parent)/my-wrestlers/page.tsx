import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { getParentYouthWrestlerIds } from '@/lib/parent-wrestlers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Edit, User, Calendar } from 'lucide-react';
import { YouthWrestler } from '@/types';
import { ProfileImage } from '@/components/profile-image';

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

  if (userData?.role === 'athlete') {
    redirect('/athlete-dashboard');
  }
  // Parent sees only their wrestlers (primary or linked). Explicit filter so parents never see other users' kids.
  const youthWrestlerIds = await getParentYouthWrestlerIds(supabase, user.id);
  const { data: youthWrestlersRaw } = youthWrestlerIds.length > 0
    ? await supabase.from('youth_wrestlers').select('*').in('id', youthWrestlerIds).order('created_at', { ascending: false })
    : { data: [] };
  const youthWrestlers = youthWrestlersRaw ?? [];

  // Sessions are linked via session_participants, not sessions.youth_wrestler_id
  let familySessionIds: string[] = [];
  if (youthWrestlerIds.length > 0) {
    const { data: partRows } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('youth_wrestler_id', youthWrestlerIds);
    familySessionIds = [...new Set((partRows ?? []).map((r: { session_id: string }) => r.session_id))];
  }

  const { data: upcomingSessionsRaw } = familySessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, session_participants(youth_wrestler_id)')
        .in('id', familySessionIds)
        .eq('status', 'scheduled')
        .gte('scheduled_datetime', new Date().toISOString())
        .order('scheduled_datetime', { ascending: true })
        .limit(50)
    : { data: [] };

  // Per-wrestler upcoming count from session_participants
  const upcomingCountByWrestler: Record<string, number> = {};
  youthWrestlerIds.forEach((id: string) => {
    upcomingCountByWrestler[id] = 0;
  });
  for (const s of upcomingSessionsRaw ?? []) {
    const parts = (s as { session_participants?: Array<{ youth_wrestler_id: string }> }).session_participants ?? [];
    for (const p of parts) {
      if (upcomingCountByWrestler[p.youth_wrestler_id] !== undefined) {
        upcomingCountByWrestler[p.youth_wrestler_id]++;
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-5 pb-8 md:py-8 max-w-full">
      <div className="mb-6 md:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1 md:text-3xl md:mb-2">My Youth Wrestlers</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Manage profiles for your wrestlers
          </p>
        </div>
        <Link href="/wrestlers/add" className="w-full sm:w-auto">
          <Button className="w-full min-h-[44px] touch-manipulation sm:w-auto">
            <Plus className="h-4 w-4 mr-2 shrink-0" />
            Add Youth Wrestler
          </Button>
        </Link>
      </div>

      {youthWrestlers && youthWrestlers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {youthWrestlers.map((wrestler: YouthWrestler) => {
            const upcomingCount = upcomingCountByWrestler[wrestler.id] ?? 0;

            return (
              <Card key={wrestler.id}>
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <ProfileImage
                      src={wrestler.photo_url}
                      alt={`${wrestler.first_name} ${wrestler.last_name}`}
                      focusX={wrestler.photo_focus_x ?? 50}
                      focusY={wrestler.photo_focus_y ?? 15}
                      className="w-16 h-16 sm:w-20 sm:h-20 shrink-0"
                      fallbackIconClassName="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground"
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg sm:text-xl">
                        {wrestler.first_name} {wrestler.last_name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {wrestler.age && `${wrestler.age} years old`}
                        {wrestler.skill_level && ` • ${wrestler.skill_level}`}
                        {wrestler.weight_class && ` • ${wrestler.weight_class}`}
                      </CardDescription>
                      {wrestler.school && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          {wrestler.school}
                          {wrestler.graduation_year && ` • Class of ${wrestler.graduation_year}`}
                        </p>
                      )}
                      {upcomingCount > 0 && (
                        <div className="mt-2 p-2 bg-muted rounded-md inline-block">
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                            <span className="font-medium">
                              {upcomingCount} upcoming session{upcomingCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <Link href={`/wrestlers/${wrestler.id}`} className="flex-1 min-w-0">
                      <Button variant="outline" className="w-full min-h-[44px] touch-manipulation">
                        View Profile
                      </Button>
                    </Link>
                    <Link href={`/wrestlers/${wrestler.id}/edit`} className="shrink-0">
                      <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px] touch-manipulation">
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
              Add a profile for your youth wrestler to start booking sessions with NCAA athletes and coaches.
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

