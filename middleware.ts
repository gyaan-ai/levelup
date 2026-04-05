import { NextRequest, NextResponse } from 'next/server';
import { getTenantByDomain, resolveHostnameFromHeaders } from '@/config/tenants';

export async function middleware(req: NextRequest) {
  const hostname = resolveHostnameFromHeaders(req.headers);

  // Extract tenant from subdomain / known domains
  const tenant = getTenantByDomain(hostname);
  
  if (!tenant) {
    return NextResponse.redirect(new URL('/404', req.url));
  }
  
  // Add tenant slug to request headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-tenant-slug', tenant.slug);
  
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};





