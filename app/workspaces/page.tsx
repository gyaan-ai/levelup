import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Users } from 'lucide-react';
import { SchoolLogo } from '@/components/school-logo';

export default async function WorkspacesPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'parent' && userData?.role !== 'athlete' && userData?.role !== 'admin') {
    redirect('/');
  }

  const admin = createAdminClient(tenant.slug);

  if (userData?.role === 'parent') {
    const { data: sessions } = await admin.from('sessions').select('id, parent_id, athlete_id').eq('parent_id', user.id).in('status', ['scheduled', 'completed']);
    if (sessions?.length) {
      const { data: participants } = await admin.from('session_participants').select('session_id, youth_wrestler_id').in('session_id', sessions.map((s) => s.id));
      const seen = new Set<string>();
      for (const p of participants || []) {
        const sess = sessions.find((s) => s.id === p.session_id);
        if (!sess) continue;
        const key = `${sess.parent_id}-${p.youth_wrestler_id}-${sess.athlete_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          await admin.rpc('get_or_create_workspace', { p_parent_id: sess.parent_id, p_youth_wrestler_id: p.youth_wrestler_id, p_athlete_id: sess.athlete_id });
        }
      }
    }
  } else if (userData?.role === 'athlete') {
    const { data: sessions } = await admin.from('sessions').select('id, parent_id, athlete_id').eq('athlete_id', user.id).in('status', ['scheduled', 'completed']);
    if (sessions?.length) {
      const { data: participants } = await admin.from('session_participants').select('session_id, youth_wrestler_id').in('session_id', sessions.map((s) => s.id));
      const seen = new Set<string>();
      for (const p of participants || []) {
        const sess = sessions.find((s) => s.id === p.session_id);
        if (!sess) continue;
        const key = `${sess.parent_id}-${p.youth_wrestler_id}-${sess.athlete_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          await admin.rpc('get_or_create_workspace', { p_parent_id: sess.parent_id, p_youth_wrestler_id: p.youth_wrestler_id, p_athlete_id: sess.athlete_id });
        }
      }
    }
  }

  let query = admin.from('workspaces').select(`
    id,
    parent_id,
    youth_wrestler_id,
    athlete_id,
    created_at,
    youth_wrestlers(id, first_name, last_name),
    athletes(id, first_name, last_name, school)
  `).order('updated_at', { ascending: false });

  if (userData?.role === 'parent') query = query.eq('parent_id', user.id);
  else if (userData?.role === 'athlete') query = query.eq('athlete_id', user.id);

  const { data: workspaces } = await query;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-primary">Development Workspaces</h1>
        <p className="text-muted-foreground mt-1">
          {userData?.role === 'parent'
            ? 'Collaboration spaces with your wrestler\'s coaches — goals, video, session notes, and actions'
            : userData?.role === 'athlete'
            ? 'Your coaching spaces — track goals, review video, and assign actions to your athletes'
            : 'All development workspaces'}
        </p>
      </div>

      {!workspaces?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No workspaces yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {userData?.role === 'parent'
                ? 'Book a session with a coach to create a development workspace. You can add goals, upload video for review, and receive session summaries and action items.'
                : 'When parents book sessions with you, workspaces are created. You can summarize sessions and assign actions for your athletes.'}
            </p>
            {userData?.role === 'parent' && (
              <Link href="/browse">
                <Button>Browse Coaches</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws: {
            id: string;
            youth_wrestlers?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[];
            athletes?: { first_name?: string; last_name?: string; school?: string } | { first_name?: string; last_name?: string; school?: string }[];
          }) => {
            const yw = Array.isArray(ws.youth_wrestlers) ? ws.youth_wrestlers[0] : ws.youth_wrestlers;
            const coach = Array.isArray(ws.athletes) ? ws.athletes[0] : ws.athletes;
            const wrestlerName = yw ? `${yw.first_name || ''} ${yw.last_name || ''}`.trim() : 'Wrestler';
            const coachName = coach ? `${coach.first_name || ''} ${coach.last_name || ''}`.trim() : 'Coach';
            const isParent = userData?.role === 'parent';
            const cardTitle = isParent ? coachName : wrestlerName;
            const subtitle = isParent ? `Athlete: ${wrestlerName}` : `Coach: ${coachName}`;
            return (
              <Link key={ws.id} href={`/workspaces/${ws.id}`}>
                <Card className="hover:border-primary/50 transition-colors h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {cardTitle}
                      {isParent && coach?.school && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <SchoolLogo school={coach.school} size="sm" />
                          ({coach.school})
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      {subtitle}
                      {!isParent && coach?.school && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <SchoolLogo school={coach.school} size="sm" />
                          ({coach.school})
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full">
                      Open workspace
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
