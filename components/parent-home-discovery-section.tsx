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
    <div className="mt-6 space-y-3">
      <p className="text-sm text-zinc-400 text-center">Popular open sessions</p>
      {sessions.map((s) => (
        <HomeDiscoverySessionCard key={s.id} session={s} parentWrestlerIds={parentWrestlerIds} />
      ))}
    </div>
  );
}
