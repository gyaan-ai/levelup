'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { ParentBottomNav } from './parent-bottom-nav';
import { CoachBottomNav } from './coach-bottom-nav';

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
];

const COACH_ROUTES = [
  '/athlete-dashboard',
  '/availability',
  '/coach-sessions',
  '/inbox',
  '/profile',
  '/rate-card',
  '/small-group-sessions',
  '/notifications',
  '/messages',
  '/workspaces',
];

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

export function ParentBottomNavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { effectiveRole } = useAuth();
  const showParentNav = effectiveRole === 'parent' && isParentRoute(pathname);
  const showCoachNav = effectiveRole === 'athlete' && isCoachRoute(pathname);
  const showNav = showParentNav || showCoachNav;

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
      {showCoachNav && <CoachBottomNav />}
    </>
  );
}
