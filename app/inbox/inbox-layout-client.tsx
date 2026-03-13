'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InboxSidebar } from './inbox-sidebar';

export function InboxLayoutClient({
  role,
  children,
}: {
  role: 'parent' | 'athlete' | 'youth_wrestler';
  children: React.ReactNode;
}) {
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileListOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)]">
      {/* Desktop: sidebar always visible */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-border bg-card flex-col h-full">
        <InboxSidebar role={role} />
      </aside>

      {/* Main content + mobile conversation list trigger */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
        {/* Mobile: bar with "Conversations" to open list */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0"
            onClick={() => setMobileListOpen(true)}
            aria-label="Open conversations"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-foreground">Community</span>
        </div>
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>

      {/* Mobile: overlay with conversation list */}
      {mobileListOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
            <span className="font-semibold">Conversations</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] shrink-0"
              onClick={() => setMobileListOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden min-h-0 w-full">
            <InboxSidebar role={role} className="w-full border-r-0" />
          </div>
        </div>
      )}
    </div>
  );
}
