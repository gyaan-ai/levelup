import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, CreditCard, Calendar, DollarSign } from 'lucide-react';
import { AccountSignOut } from '@/components/account-sign-out';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role === 'athlete') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin') redirect('/dashboard');

  const { data: youthWrestlers } = await supabase
    .from('youth_wrestlers')
    .select('id')
    .order('created_at', { ascending: false });
  const youthWrestlerIds = (youthWrestlers ?? []).map((r: { id: string }) => r.id);

  let familySessionIds: string[] = [];
  if (youthWrestlerIds.length > 0) {
    const { data: partRows } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('youth_wrestler_id', youthWrestlerIds);
    familySessionIds = [...new Set((partRows ?? []).map((r: { session_id: string }) => r.session_id))];
  }

  const { data: paidSessions } = familySessionIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, total_price, scheduled_datetime, refunded_at')
        .in('id', familySessionIds)
        .in('status', ['scheduled', 'completed'])
    : { data: [] };

  const nonRefunded = (paidSessions ?? []).filter(
    (s: { refunded_at?: string | null }) => !s.refunded_at
  ) as Array<{ total_price: number; scheduled_datetime: string }>;

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  let totalSpent = 0;
  let thisMonthSpent = 0;
  let lastMonthSpent = 0;
  for (const s of nonRefunded) {
    totalSpent += Number(s.total_price);
    const month = s.scheduled_datetime.slice(0, 7);
    if (month === thisMonth) thisMonthSpent += Number(s.total_price);
    if (month === lastMonth) lastMonthSpent += Number(s.total_price);
  }

  return (
    <div className="container mx-auto px-4 py-5 pb-8 md:py-8 max-w-full">
      <h1 className="text-2xl font-bold text-foreground md:text-3xl mb-1">Account</h1>
      <p className="text-muted-foreground text-sm md:text-base mb-6">Settings and spending</p>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Wrestlers
            </CardTitle>
            <CardDescription>Manage your wrestler profiles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/my-wrestlers" className="block">
              <Button variant="outline" className="w-full min-h-[44px] touch-manipulation">
                View wrestlers
              </Button>
            </Link>
            <Link href="/wrestlers/add" className="block">
              <Button className="w-full min-h-[44px] touch-manipulation">Add wrestler</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payment
            </CardTitle>
            <CardDescription>Payment methods and billing</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Payment is collected at checkout when you book.</p>
            <Link href="/bookings">
              <Button variant="outline" className="w-full min-h-[44px] touch-manipulation">
                View sessions
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Session history
            </CardTitle>
            <CardDescription>Upcoming and past sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/bookings">
              <Button variant="outline" className="w-full min-h-[44px] touch-manipulation">
                My sessions
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Spending summary
            </CardTitle>
            <CardDescription>What you&apos;ve spent on sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Total spent</p>
              <p className="text-2xl font-bold text-accent">${totalSpent.toFixed(2)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">This month</p>
                <p className="text-lg font-semibold">${thisMonthSpent.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last month</p>
                <p className="text-lg font-semibold">${lastMonthSpent.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <AccountSignOut />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
