import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantByDomain } from '@/config/tenants';

/** Comma-separated emails that should have admin role. Set ADMIN_EMAILS in env. */
function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function POST(req: NextRequest) {
  try {
    const hostname = req.headers.get('host') || '';
    const tenant = getTenantByDomain(hostname);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient(tenant.slug);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Invalid email or password' },
        { status: 401 }
      );
    }

    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', authData.user.id);

    const adminEmails = getAdminEmails();
    const emailLower = (authData.user.email ?? '').toLowerCase();
    if (adminEmails.has(emailLower)) {
      try {
        const admin = createAdminClient(tenant.slug);
        await admin
          .from('users')
          .update({ role: 'admin' })
          .eq('id', authData.user.id);
      } catch (e) {
        console.warn('Admin promotion skip (admin client unavailable):', e);
      }
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: userData.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}





