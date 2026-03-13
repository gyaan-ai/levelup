'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Dumbbell, CalendarDays, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 5 items max; one-word labels for legibility. Coaches live inside Training. */
const ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/training', label: 'Training', icon: Dumbbell },
  { href: '/bookings', label: 'Sessions', icon: CalendarDays },
  { href: '/inbox', label: 'Messages', icon: MessageCircle },
  { href: '/account', label: 'Account', icon: User },
] as const;

export function ParentBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main navigation"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href ||
          (href !== '/dashboard' && pathname.startsWith(href));
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
