'use client';

import { useLayoutEffect } from 'react';
import type { CartSession } from '@/lib/cart-context';

/**
 * When the parent has exactly one wrestler profile, assign that kid to each cart line that
 * is still unassigned — unless there are multiple lines for the same session (then the parent
 * must pick which line is for whom when they add a second kid later).
 * Runs in useLayoutEffect so state is updated before paint (avoids checkout racing ahead without athlete_id).
 */
export function useAutoAssignSoloWrestler(
  items: CartSession[],
  wrestlers: { id: string }[],
  setAthleteForItem: (lineId: string, athleteId: string | null) => void
) {
  useLayoutEffect(() => {
    if (wrestlers.length !== 1) return;
    const wid = wrestlers[0].id;
    const linesPerSession = new Map<string, number>();
    for (const i of items) {
      linesPerSession.set(i.id, (linesPerSession.get(i.id) ?? 0) + 1);
    }
    for (const item of items) {
      if (item.athlete_id) continue;
      if ((linesPerSession.get(item.id) ?? 0) > 1) continue;
      setAthleteForItem(item.lineId, wid);
    }
  }, [items, wrestlers, setAthleteForItem]);
}
