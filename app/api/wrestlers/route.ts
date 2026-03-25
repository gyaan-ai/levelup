import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByHost } from '@/lib/tenant';

export async function GET() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByHost(host);
  if (!tenant) return NextResponse.json({ wrestlers: [] });

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ wrestlers: [] });
  }

  const { data: wrestlers, error } = await supabase
    .from('youth_wrestlers')
    .select('id, first_name, last_name')
    .eq('parent_id', user.id)
    .order('first_name');

  if (error) {
    return NextResponse.json({ wrestlers: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wrestlers: wrestlers ?? [] });
}
