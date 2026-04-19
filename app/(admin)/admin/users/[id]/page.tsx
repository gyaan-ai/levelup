import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';
import { BackLink } from '@/components/back-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEST } from '@/lib/format-date';

export const dynamic = 'force-dynamic';

type YouthRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  active: boolean | null;
  parent_id: string | null;
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id?.trim()) notFound();

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();
  if (!adminUser) redirect('/login');

  const { data: gate } = await supabase.from('users').select('role').eq('id', adminUser.id).single();
  if (gate?.role !== 'admin') redirect('/');

  const admin = createAdminClient(tenant.slug);
  const { data: row, error } = await admin
    .from('users')
    .select('id, email, role, created_at, last_login_at, archived_at, first_name, last_name')
    .eq('id', id)
    .maybeSingle();

  if (error || !row) notFound();

  const u = row as {
    id: string;
    email: string;
    role: string;
    created_at: string;
    last_login_at: string | null;
    archived_at: string | null;
    first_name: string | null;
    last_name: string | null;
  };

  const displayName =
    [u.first_name, u.last_name].filter(Boolean).join(' ').trim() ||
    (u.email.includes('@') ? u.email.split('@')[0] : u.email);

  let kidsSection: { rows: Array<YouthRow & { linkRelation: 'primary' | 'linked' }> } | null = null;
  let parentsSection: Array<{ id: string; email: string; relation: string }> | null = null;
  let coachAthlete: { school: string | null; active: boolean | null } | null = null;

  if (u.role === 'parent') {
    const byId = new Map<string, YouthRow & { linkRelation: 'primary' | 'linked' }>();

    const { data: primary } = await admin
      .from('youth_wrestlers')
      .select('id, first_name, last_name, active, parent_id')
      .eq('parent_id', u.id);

    for (const k of primary ?? []) {
      const y = k as YouthRow;
      byId.set(y.id, { ...y, linkRelation: 'primary' });
    }

    const { data: links } = await admin.from('youth_wrestler_parents').select('youth_wrestler_id').eq('parent_id', u.id);

    const linkedIds = [...new Set((links ?? []).map((l) => (l as { youth_wrestler_id: string }).youth_wrestler_id))];
    if (linkedIds.length > 0) {
      const { data: linkedKids } = await admin
        .from('youth_wrestlers')
        .select('id, first_name, last_name, active, parent_id')
        .in('id', linkedIds);
      for (const k of linkedKids ?? []) {
        const y = k as YouthRow;
        if (byId.has(y.id)) continue;
        byId.set(y.id, { ...y, linkRelation: 'linked' });
      }
    }

    kidsSection = { rows: [...byId.values()] };
  }

  if (u.role === 'youth_wrestler') {
    const { data: yw } = await admin
      .from('youth_wrestlers')
      .select('id, first_name, last_name, active, parent_id')
      .eq('id', u.id)
      .maybeSingle();

    const parentRows: Array<{ id: string; email: string; relation: string }> = [];

    if (yw) {
      const y = yw as YouthRow;
      if (y.parent_id) {
        const { data: p } = await admin.from('users').select('id, email').eq('id', y.parent_id).maybeSingle();
        if (p) {
          parentRows.push({
            id: (p as { id: string }).id,
            email: (p as { email: string }).email,
            relation: 'Primary parent',
          });
        }
      }

      const { data: extra } = await admin.from('youth_wrestler_parents').select('parent_id').eq('youth_wrestler_id', u.id);

      const extraIds = (extra ?? []).map((r) => (r as { parent_id: string }).parent_id).filter(Boolean);
      if (extraIds.length > 0) {
        const { data: usersRows } = await admin.from('users').select('id, email').in('id', extraIds);
        for (const pr of usersRows ?? []) {
          const pid = (pr as { id: string }).id;
          if (pid === y.parent_id) continue;
          parentRows.push({
            id: pid,
            email: (pr as { email: string }).email,
            relation: 'Linked parent',
          });
        }
      }
    }

    parentsSection = parentRows;
  }

  if (u.role === 'coach') {
    const { data: a } = await admin.from('athletes').select('school, active').eq('id', u.id).maybeSingle();
    if (a) coachAthlete = { school: (a as { school?: string }).school ?? null, active: (a as { active?: boolean }).active ?? null };
  }

  const { count: reviewCount } = await admin.from('reviews').select('id', { count: 'exact', head: true }).eq('parent_id', u.id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-4">
        <BackLink fallbackHref="/admin/users" label="Back to users" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">{displayName}</h1>
          <p className="text-muted-foreground text-sm mt-1">{u.email}</p>
          <code className="text-xs text-muted-foreground block mt-2 break-all" title="User id">
            {u.id}
          </code>
        </div>
        <Badge variant="outline" className="capitalize">
          {u.role}
        </Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Created:</span>{' '}
            {formatEST(new Date(u.created_at), 'MMM d, yyyy h:mm a')}
          </p>
          <p>
            <span className="font-medium text-foreground">Last login:</span>{' '}
            {u.last_login_at ? formatEST(new Date(u.last_login_at), 'MMM d, yyyy h:mm a') : '—'}
          </p>
          <p>
            <span className="font-medium text-foreground">Status:</span>{' '}
            {u.archived_at ? `Archived (${formatEST(new Date(u.archived_at), 'MMM d, yyyy')})` : 'Active'}
          </p>
          {u.role === 'parent' && (
            <p>
              <span className="font-medium text-foreground">Coach reviews submitted:</span> {reviewCount ?? 0}
            </p>
          )}
          {u.role === 'coach' && coachAthlete && (
            <>
              <p>
                <span className="font-medium text-foreground">School / club:</span> {coachAthlete.school || '—'}
              </p>
              <p>
                <span className="font-medium text-foreground">Browse:</span>{' '}
                {coachAthlete.active ? 'Visible' : 'Hidden'}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={`/athlete/${u.id}`}>Open coach public profile</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {u.role === 'parent' && kidsSection && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Wrestlers (kids)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kidsSection.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No youth wrestler profiles linked to this parent.</p>
            ) : (
              <ul className="space-y-2">
                {kidsSection.rows.map((k) => {
                  const nm = [k.first_name, k.last_name].filter(Boolean).join(' ').trim() || '—';
                  const status = k.active === false ? 'Inactive' : 'Active';
                  return (
                    <li
                      key={k.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
                    >
                      <div>
                        <span className="font-medium text-foreground">{nm}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({k.linkRelation === 'primary' ? 'Primary' : 'Linked'} · {status})
                        </span>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/wrestlers/${k.id}`}>View wrestler</Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {u.role === 'youth_wrestler' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Parents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!parentsSection || parentsSection.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No parent accounts linked (self-managed youth account or missing links).
              </p>
            ) : (
              <ul className="space-y-2">
                {parentsSection.map((p) => (
                  <li
                    key={`${p.id}-${p.relation}`}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
                  >
                    <div>
                      <span className="text-sm text-muted-foreground">{p.relation}</span>
                      <p className="font-medium">
                        <Link href={`/admin/users/${p.id}`} className="text-accent hover:underline">
                          {p.email}
                        </Link>
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/admin/users/${p.id}`}>Admin profile</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/wrestlers/${u.id}`}>Open wrestler profile (app)</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
