'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { ParentBottomNav } from './parent-bottom-nav';
import { CoachBottomNav } from './coach-bottom-nav';
import { YouthWrestlerBottomNav } from './youth-wrestler-bottom-nav';
import { AdminBottomNav } from './admin-bottom-nav';
import { FloatingCartButton } from './floating-cart-button';

const PARENT_ROUTES = [
  '/dashboard',
  '/training',
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
  '/cart',
  '/wallet',
];

const COACH_ROUTES = [
  '/athlete-dashboard',
  '/availability',
  '/coach-sessions',
  '/coach-earnings',
  '/coach-reviews',
  '/inbox',
  '/profile',
  '/rate-card',
  '/small-group-sessions',
  '/notifications',
  '/messages',
  '/workspaces',
];

const YOUTH_WRESTLER_ROUTES = [
  '/youth-dashboard',
  '/workspaces',
  '/small-group-sessions',
  '/inbox',
  '/notifications',
];

const ADMIN_ROUTES = ['/dashboard', '/admin', '/account'];

function isParentRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return PARENT_ROUTES.some(
    (route) => pathname === route || (route !== '/dashboard' && pathname.startsWith(route + '/'))
  );
}

function isCoachRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return COACH_ROUTES.some(
    (route) =>
      pathname === route ||
      (route !== '/athlete-dashboard' && pathname.startsWith(route + '/'))
  );
}

function isYouthWrestlerRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return YOUTH_WRESTLER_ROUTES.some(
    (route) =>
      pathname === route ||
      (route !== '/youth-dashboard' && pathname.startsWith(route + '/'))
  );
}

function isAdminRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
}

/** One menu system on mobile: bottom nav for everyone (parent, coach, youth_wrestler, admin). */
export function ParentBottomNavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { effectiveRole } = useAuth();
  const showParentNav = effectiveRole === 'parent' && isParentRoute(pathname);
  const showCoachNav = effectiveRole === 'coach' && isCoachRoute(pathname);
  const showYouthNav = effectiveRole === 'youth_wrestler' && isYouthWrestlerRoute(pathname);
  const showAdminNav = effectiveRole === 'admin' && isAdminRoute(pathname);
  const showNav = showParentNav || showCoachNav || showYouthNav || showAdminNav;

  return (
    <>
      {showNav ? (
        <div className="pb-20 md:pb-0">
          {children}
        </div>
      ) : (
        children
      )}
      {showParentNav && <ParentBottomNav />}
      {showParentNav && <FloatingCartButton />}
      {showCoachNav && <CoachBottomNav />}
      {showYouthNav && <YouthWrestlerBottomNav />}
      {showAdminNav && <AdminBottomNav />}
    </>
  );
}
