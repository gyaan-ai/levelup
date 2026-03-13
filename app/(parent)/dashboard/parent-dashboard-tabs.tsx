'use client';

import Link from 'next/link';
import { Calendar, UserPlus, Search, Users } from 'lucide-react';

const TABS = [
  { id: 'scheduled', label: 'Scheduled', href: '/dashboard', icon: Calendar },
  { id: 'book', label: 'Book', href: '/dashboard?tab=book', icon: UserPlus },
  { id: 'find-training', label: 'Find training', href: '/dashboard?tab=find-training', icon: Search },
  { id: 'group', label: 'Group & partner', href: '/dashboard?tab=group', icon: Users },
] as const;

export type ParentDashboardTab = (typeof TABS)[number]['id'];

export function ParentDashboardTabs({ activeTab }: { activeTab: ParentDashboardTab }) {
  const basePath = '/dashboard';

  return (
    <div className="border-b border-border mb-4 md:mb-6 -mx-4 px-4 overflow-x-auto overflow-y-hidden">
      <nav className="flex gap-0 min-w-0 flex-nowrap md:flex-wrap" aria-label="Dashboard sections">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const href = tab.id === 'scheduled' ? basePath : `${basePath}?tab=${tab.id}`;
          return (
            <Link
              key={tab.id}
              href={href}
              className={`
                flex items-center gap-2 px-4 py-3 min-h-[44px] min-w-0 shrink-0 md:shrink text-sm font-medium border-b-2 transition-colors -mb-px touch-manipulation
                ${isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
