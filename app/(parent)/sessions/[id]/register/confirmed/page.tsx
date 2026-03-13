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

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-accent">
            <CheckCircle className="h-6 w-6" />
            You’re registered
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Payment completed. Your wrestler is signed up for this session. You’ll see it under Dashboard → Scheduled and in Bookings.
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard">Go to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
