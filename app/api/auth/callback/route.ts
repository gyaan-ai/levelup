import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';

export async function GET(req: NextRequest) {
  try {
    const hostname = req.headers.get('host') || '';
    const tenant = getTenantByDomain(hostname);
    
    if (!tenant) {
      return NextResponse.redirect(new URL('/404', req.url));
    }

    const supabase = await createClient(tenant.slug);
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(new URL('/login?error=auth_failed', req.url));
      }
    }

    // Get user role to redirect appropriately
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = userData?.role || 'parent';
    const redirectPath = 
      role === 'athlete' ? '/athlete-dashboard' :
      role === 'youth_wrestler' ? '/youth-dashboard' :
      role === 'admin' ? '/admin' : '/dashboard';

    return NextResponse.redirect(new URL(redirectPath, req.url));
  } catch (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=callback_failed', req.url));
  }
}

