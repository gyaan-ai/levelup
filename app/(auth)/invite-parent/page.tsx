import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { verifyInviteToken } from '@/lib/invite-parent-token';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';

export default async function InviteParentPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp?.token === 'string' ? sp.token.trim() : '';

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid invite link</CardTitle>
            <CardDescription>This link is missing or invalid. Ask the parent who invited you to send a new link.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button variant="outline">Go to log in</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const payload = verifyInviteToken(token);
  if (!payload) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link expired or invalid</CardTitle>
            <CardDescription>This invite link has expired or is no longer valid. Ask the parent who invited you to create a new link.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button variant="outline">Go to log in</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const admin = createAdminClient(tenant.slug);
  const { data: yw } = await admin.from('youth_wrestlers').select('first_name, last_name').eq('id', payload.youthWrestlerId).single();
  const kidName = yw ? `${yw.first_name} ${yw.last_name}`.trim() || 'this wrestler' : 'this wrestler';

  if (user) {
    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userData?.role === 'parent') {
      const { data: ywCheck } = await admin.from('youth_wrestlers').select('parent_id').eq('id', payload.youthWrestlerId).single();
      if (ywCheck && ywCheck.parent_id !== user.id) {
        const { error } = await admin.from('youth_wrestler_parents').insert({
          youth_wrestler_id: payload.youthWrestlerId,
          parent_id: user.id,
        });
        if (error && error.code !== '23505') {
          console.warn('Invite parent: link failed', error);
        }
      }
      redirect('/dashboard');
    }
  }

  const signupUrl = `/signup?invite=${encodeURIComponent(token)}`;
  const loginUrl = `/login?redirect=${encodeURIComponent(`/invite-parent?token=${encodeURIComponent(token)}`)}`;

  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            You&apos;re invited
          </CardTitle>
          <CardDescription>
            You&apos;ve been invited to be a linked parent for <strong>{kidName}</strong>. You&apos;ll see their profile and can book sessions. Create an account or log in to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href={signupUrl} className="block">
            <Button className="w-full">Create account</Button>
          </Link>
          <Link href={loginUrl} className="block">
            <Button variant="outline" className="w-full">I already have an account</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
