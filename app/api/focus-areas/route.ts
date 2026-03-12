import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { SESSION_FOCUS_AREAS } from '@/lib/focus-areas';

/** GET - List session focus areas (topics) for dropdowns. From DB if available, else fallback to constant. */
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const supabase = await createClient(tenant.slug);
    const { data: rows, error } = await supabase
      .from('session_focus_areas')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true });

    if (error || !rows || rows.length === 0) {
      return NextResponse.json({
        focusAreas: [...SESSION_FOCUS_AREAS],
        source: 'fallback',
      });
    }
    return NextResponse.json({
      focusAreas: rows.map((r: { name: string }) => r.name),
      source: 'db',
    });
  } catch (e) {
    console.error('Focus areas GET error:', e);
    return NextResponse.json({
      focusAreas: [...SESSION_FOCUS_AREAS],
      source: 'fallback',
    });
  }
}
