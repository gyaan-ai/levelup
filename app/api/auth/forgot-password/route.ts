import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { getPublicSiteUrlFromRequest } from '@/lib/public-site-url';

/**
 * Sends Supabase password recovery email. Uses NEXT_PUBLIC_APP_URL for redirect when set
 * so production reset links are never localhost (Vercel env must match the live domain).
 */
export async function POST(req: NextRequest) {
  try {
    const hostname = req.headers.get('host') || '';
    const tenant = getTenantByDomain(hostname);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const supabase = await createClient(tenant.slug);
    const base = getPublicSiteUrlFromRequest(req);
    const redirectTo = `${base}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('forgot-password:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
