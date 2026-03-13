import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export default async function SessionRegisterConfirmedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = await params;
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/sessions/${sessionId}/register/confirmed`);

  const { data: session } = await supabase
    .from('sessions')
    .select('athlete_id')
    .eq('id', sessionId)
    .single();
  const coachId = (session as { athlete_id?: string } | null)?.athlete_id ?? '';

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-accent">
            <CheckCircle className="h-6 w-6" />
            You’re registered
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Payment completed. Your wrestler is signed up for this session. You’ll see it under Sessions and in Bookings.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {coachId && (
            <Button asChild className="w-full">
              <Link href={`/training?tab=sessions&coach=${coachId}`}>Book another with this coach</Link>
            </Button>
          )}
          <Button asChild variant={coachId ? 'outline' : 'default'} className="w-full">
            <Link href="/training">Book another session</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/bookings">Done — Back to Sessions</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
