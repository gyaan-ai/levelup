'use client';

import type { DiscoverySession } from '@/components/home-discovery-session-card';
import { HomeDiscoverySessionCard } from '@/components/home-discovery-session-card';

export function ParentHomeDiscoverySection({
  sessions,
  parentWrestlerIds,
}: {
  sessions: DiscoverySession[];
  parentWrestlerIds: string[];
}) {
  if (sessions.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {sessions.map((s) => (
        <HomeDiscoverySessionCard key={s.id} session={s} parentWrestlerIds={parentWrestlerIds} />
      ))}
    </div>
  );
}
