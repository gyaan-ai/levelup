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
    <div className="border-b border-border mb-6">
      <nav className="flex flex-wrap gap-1" aria-label="Dashboard sections">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const href = tab.id === 'scheduled' ? basePath : `${basePath}?tab=${tab.id}`;
          return (
            <Link
              key={tab.id}
              href={href}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px
                ${isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
