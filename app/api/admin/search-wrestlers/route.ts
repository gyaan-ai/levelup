import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const tenantSlug = searchParams.get('tenant') || 'guild';

  if (query.length < 2) {
    return NextResponse.json({ wrestlers: [] });
  }

  const supabase = createAdminClient(tenantSlug);

  // Search youth wrestlers by name
  const { data: wrestlers, error } = await supabase
    .from('youth_wrestlers')
    .select('id, first_name, last_name, photo_url, parent_id')
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error('Search wrestlers error:', error);
    return NextResponse.json({ wrestlers: [] });
  }

  return NextResponse.json({ wrestlers: wrestlers || [] });
}
