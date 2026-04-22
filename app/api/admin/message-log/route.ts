import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(req: Request) {
  const hdrs = await headers();
  const host = hdrs.get('host') ?? '';
  const tenant = getTenantByDomain(host);
  if (!tenant) {
    return NextResponse.json({ error: 'Unknown tenant' }, { status: 400 });
  }

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient(tenant.slug);

  const url = new URL(req.url);
  const channel = url.searchParams.get('channel'); // 'sms' | 'notification' | null (all)
  const limit = parseInt(url.searchParams.get('limit') || '100', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  let query = admin
    .from('message_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (channel === 'sms' || channel === 'notification') {
    query = query.eq('channel', channel);
  }

  const { data, error, count } = await query;

  const enrichRecipientLabels = async (
    rows: Record<string, unknown>[]
  ): Promise<Record<string, unknown>[]> => {
    const need = new Set<string>();
    for (const r of rows) {
      const labelEmpty = !String(r.recipient_label ?? '').trim();
      if (
        r.channel === 'notification' &&
        r.recipient_id &&
        labelEmpty &&
        typeof r.recipient_id === 'string'
      ) {
        need.add(r.recipient_id);
      }
    }
    if (need.size === 0) return rows;

    const ids = [...need];
    const { data: userRows } = await admin
      .from('users')
      .select('id, first_name, last_name, role, email')
      .in('id', ids);

    const labelById = new Map<string, string>();
    for (const u of userRows ?? []) {
      const row = u as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        role: string | null;
        email: string | null;
      };
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
      const role =
        row.role && row.role.length > 0
          ? row.role.charAt(0).toUpperCase() + row.role.slice(1)
          : 'User';
      const label = name ? `${name} (${role})` : row.email || `${row.id.slice(0, 8)}…`;
      labelById.set(row.id, label);
    }

    return rows.map((r) => {
      if (
        r.channel !== 'notification' ||
        !r.recipient_id ||
        String(r.recipient_label ?? '').trim() ||
        typeof r.recipient_id !== 'string'
      ) {
        return r;
      }
      const resolved = labelById.get(r.recipient_id);
      if (!resolved) {
        return {
          ...r,
          recipient_label: `User ${(r.recipient_id as string).slice(0, 8)}…`,
        };
      }
      return { ...r, recipient_label: resolved };
    });
  };

  if (error) {
    const msg = error.message ?? String(error);
    const code = 'code' in error ? String((error as { code?: string }).code) : '';
    const looksLikeMissingTable =
      /message_log/i.test(msg) &&
      (/does not exist|schema cache|Could not find/i.test(msg) || code === '42P01' || code === 'PGRST205');
    if (looksLikeMissingTable) {
      return NextResponse.json(
        {
          error:
            'Database table message_log is missing. Apply the migration supabase/migrations/20260425120000_message_log.sql to this Supabase project, then retry.',
          detail: msg,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg, code: code || undefined }, { status: 500 });
  }

  const messages = await enrichRecipientLabels((data ?? []) as Record<string, unknown>[]);

  return NextResponse.json({ messages, total: count ?? 0 });
}
