'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { ParentBottomNav } from './parent-bottom-nav';

const PARENT_ROUTES = [
  '/dashboard',
  '/find-training',
  '/browse',
  '/bookings',
  '/inbox',
  '/account',
  '/my-wrestlers',
  '/my-coaches',
  '/partner-sessions',
  '/small-group-sessions',
  '/wrestlers',
  '/sessions',
];

function isParentRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return PARENT_ROUTES.some(
    (route) => pathname === route || (route !== '/dashboard' && pathname.startsWith(route + '/'))
  );
}

export function ParentBottomNavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { effectiveRole } = useAuth();
  const showNav = effectiveRole === 'parent' && isParentRoute(pathname);

  return (
    <>
      {showNav ? (
        <div className="pb-20 md:pb-0">
          {children}
        </div>
      ) : (
        children
      )}
      {showNav && <ParentBottomNav />}
    </>
  );
}
