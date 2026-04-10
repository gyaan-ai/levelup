import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { BackLink } from '@/components/back-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEST } from '@/lib/format-date';

type EarlyAccessRow = {
  id: string;
  email: string;
  name?: string | null;
  interest?: string | null;
  parent_name?: string | null;
  wrestler_name?: string | null;
  school_club?: string | null;
  graduation_year?: number | null;
  dob?: string | null;
  parent_phone?: string | null;
  weight_class?: string | null;
  experience_level?: string | null;
  created_at: string;
};

export default async function AdminEarlyAccessPage() {
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
    .from('early_access')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Early access fetch error:', error);
  }

  const list = (rows ?? []) as EarlyAccessRow[];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <BackLink fallbackHref="/admin" label="Back to Admin" />
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif text-foreground">Early Access Submissions</h1>
        <p className="text-muted-foreground mt-1">
          Homepage signups (testers, early adopters)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All submissions</CardTitle>
          <CardDescription>
            {list.length} signup{list.length !== 1 ? 's' : ''}. Newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 font-medium">Submitted</th>
                    <th className="p-2 font-medium">Parent</th>
                    <th className="p-2 font-medium">Email</th>
                    <th className="p-2 font-medium">Phone</th>
                    <th className="p-2 font-medium">Wrestler</th>
                    <th className="p-2 font-medium">School / Club</th>
                    <th className="p-2 font-medium">Grad year</th>
                    <th className="p-2 font-medium">DOB</th>
                    <th className="p-2 font-medium">Weight</th>
                    <th className="p-2 font-medium">Experience</th>
                    <th className="p-2 font-medium">Interest</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-2 text-muted-foreground whitespace-nowrap">
                        {formatEST(new Date(r.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="p-2">{r.parent_name ?? r.name ?? '—'}</td>
                      <td className="p-2">{r.email}</td>
                      <td className="p-2">{r.parent_phone ?? '—'}</td>
                      <td className="p-2">{r.wrestler_name ?? '—'}</td>
                      <td className="p-2">{r.school_club ?? '—'}</td>
                      <td className="p-2">{r.graduation_year ? `Class of ${r.graduation_year}` : '—'}</td>
                      <td className="p-2">{r.dob ? formatEST(new Date(r.dob), 'M/d/yyyy') : '—'}</td>
                      <td className="p-2">{r.weight_class ?? '—'}</td>
                      <td className="p-2">{r.experience_level ?? '—'}</td>
                      <td className="p-2">{r.interest ?? '—'}</td>
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
