import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

async function requireAdmin(tenantSlug: string) {
  const supabase = await createClient(tenantSlug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (userData?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { supabase };
}

/** GET — list parent home announcements + dismiss counts per (type, reference_id). */
export async function GET() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await requireAdmin(tenant.slug);
    if ('error' in auth) return auth.error;

    const admin = createAdminClient(tenant.slug);
    const { data: rows, error } = await admin
      .from('parent_announcements')
      .select('id, announcement_type, reference_id, headline, cta_label, cta_path, created_at, expires_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: dismissRows } = await admin
      .from('parent_announcement_dismissals')
      .select('announcement_type, reference_id');

    const dismissKey = (t: string, r: string) => `${t}:${r}`;
    const dismissCounts = new Map<string, number>();
    for (const d of dismissRows ?? []) {
      const dr = d as { announcement_type?: string; reference_id?: string };
      if (!dr.announcement_type || !dr.reference_id) continue;
      const k = dismissKey(dr.announcement_type, dr.reference_id);
      dismissCounts.set(k, (dismissCounts.get(k) ?? 0) + 1);
    }

    const announcements = (rows ?? []).map((r) => {
      const row = r as {
        id: string;
        announcement_type: string;
        reference_id: string;
        headline: string;
        cta_label: string;
        cta_path: string;
        created_at: string;
        expires_at: string;
      };
      return {
        ...row,
        dismiss_count: dismissCounts.get(dismissKey(row.announcement_type, row.reference_id)) ?? 0,
      };
    });

    return NextResponse.json({ announcements });
  } catch (e) {
    console.error('admin parent-announcements GET', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST — create announcement. */
export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const tenant = getTenantByDomain(host);
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const auth = await requireAdmin(tenant.slug);
    if ('error' in auth) return auth.error;

    const body = (await req.json()) as {
      announcement_type?: string;
      reference_id?: string;
      headline?: string;
      cta_label?: string;
      cta_path?: string;
      expires_at?: string;
    };

    const announcementType = body.announcement_type?.trim();
    const referenceId = body.reference_id?.trim();
    const headline = body.headline?.trim();
    const ctaLabel = (body.cta_label?.trim() || 'View Profile').slice(0, 120);
    const ctaPath = body.cta_path?.trim();
    const expiresAt = body.expires_at?.trim();

    if (announcementType !== 'new_coach' && announcementType !== 'new_location') {
      return NextResponse.json({ error: 'announcement_type must be new_coach or new_location' }, { status: 400 });
    }
    if (!referenceId) return NextResponse.json({ error: 'reference_id is required' }, { status: 400 });
    if (!headline) return NextResponse.json({ error: 'headline is required' }, { status: 400 });
    if (!ctaPath) return NextResponse.json({ error: 'cta_path is required' }, { status: 400 });
    if (!expiresAt) return NextResponse.json({ error: 'expires_at is required' }, { status: 400 });

    const exp = new Date(expiresAt);
    if (Number.isNaN(exp.getTime())) {
      return NextResponse.json({ error: 'expires_at must be a valid date' }, { status: 400 });
    }
    if (exp <= new Date()) {
      return NextResponse.json({ error: 'expires_at must be in the future' }, { status: 400 });
    }

    const admin = createAdminClient(tenant.slug);
    const { data: row, error } = await admin
      .from('parent_announcements')
      .insert({
        announcement_type: announcementType,
        reference_id: referenceId,
        headline,
        cta_label: ctaLabel,
        cta_path: ctaPath.startsWith('/') ? ctaPath : `/${ctaPath}`,
        expires_at: exp.toISOString(),
      })
      .select('id, announcement_type, reference_id, headline, cta_label, cta_path, created_at, expires_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(row);
  } catch (e) {
    console.error('admin parent-announcements POST', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
