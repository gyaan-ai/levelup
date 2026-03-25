import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(req: Request) {
  const hdrs = await headers();
  const host = hdrs.get('host') ?? '';
  const tenant = getTenantByDomain(host);
  if (!tenant) {
    return NextResponse.json({ error: 'Unknown tenant' }, { status: 400 });
  }
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [], total: count ?? 0 });
}
