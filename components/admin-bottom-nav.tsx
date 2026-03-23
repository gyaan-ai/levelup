'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Gauge, Calendar, Users, CreditCard, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Admin mobile bottom nav. Account = settings + sign out (same pattern as parent nav). */
const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/admin', label: 'Cockpit', icon: Gauge },
  { href: '/admin?tab=sessions', label: 'Sessions', icon: Calendar },
  { href: '/admin?tab=users', label: 'Users', icon: Users },
  { href: '/admin?tab=billing', label: 'Billing', icon: CreditCard },
  { href: '/account', label: 'Account', icon: User },
] as const;

export function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Admin navigation"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const path = href.split('?')[0];
        const isActive =
          path === '/account'
            ? pathname === '/account' || pathname.startsWith('/account/')
            : pathname === path || (path === '/admin' && pathname.startsWith('/admin'));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center justify-center min-h-[44px] min-w-0 flex-1 py-2 px-2 touch-manipulation text-[11px] font-medium transition-colors whitespace-nowrap overflow-visible',
              isActive ? 'text-accent' : 'text-muted-foreground'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="h-5 w-5 shrink-0 mb-0.5" aria-hidden />
            <span className="overflow-visible whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
