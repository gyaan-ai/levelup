import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { BackLink } from '@/components/back-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DiscountCodesClient } from './discount-codes-client';
import { DiscountCodePauseButton } from './discount-code-pause-button';
import { formatEST } from '@/lib/format-date';
import { resolveDiscountPercentOff } from '@/lib/discount-codes';

type DiscountCodeRow = {
  id: string;
  code: string;
  name?: string | null;
  max_redemptions?: number | null;
  redemptions: number;
  active?: boolean;
  percent_off?: number | null;
  created_at: string;
};

export default async function AdminDiscountCodesPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') redirect('/');

  const admin = createAdminClient(tenant.slug);
  const { data: rows, error } = await admin
    .from('discount_codes')
    .select('id, code, name, max_redemptions, redemptions, active, percent_off, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Discount codes fetch error:', error);
  }

  const codes = (rows ?? []) as DiscountCodeRow[];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <BackLink fallbackHref="/admin" label="Back to Admin" />
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif text-foreground">Discount codes</h1>
        <p className="text-muted-foreground mt-1">
          Early adopter / signup codes. Parents enter a code on signup to get 1 free private + 1 free small group session.
        </p>
      </div>

      <DiscountCodesClient initialCodes={codes} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Existing codes</CardTitle>
          <CardDescription>
            {codes.length} code{codes.length !== 1 ? 's' : ''}. Newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-muted-foreground">No codes yet. Create one above.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 font-medium">Code</th>
                    <th className="p-2 font-medium">Name</th>
                    <th className="p-2 font-medium">Type</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Redemptions</th>
                    <th className="p-2 font-medium">Max</th>
                    <th className="p-2 font-medium">Created</th>
                    <th className="p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="p-2 font-mono font-medium">{c.code}</td>
                      <td className="p-2 text-muted-foreground">{c.name ?? '—'}</td>
                      <td className="p-2 text-muted-foreground">
                        {(() => {
                          const pct = resolveDiscountPercentOff(c.code, c.percent_off);
                          return pct != null ? `${pct}% off` : '—';
                        })()}
                      </td>
                      <td className="p-2">
                        {c.active !== false ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">Paused</span>
                        )}
                      </td>
                      <td className="p-2">{c.redemptions}</td>
                      <td className="p-2">{c.max_redemptions ?? 'Unlimited'}</td>
                      <td className="p-2 text-muted-foreground">{formatEST(new Date(c.created_at), 'MMM d, yyyy')}</td>
                      <td className="p-2">
                        <DiscountCodePauseButton id={c.id} code={c.code} active={c.active !== false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
