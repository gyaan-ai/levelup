'use client';

import { useState, useEffect, useCallback } from 'react';

export function useCoachPendingRequestsCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    if (!enabled) return;
    fetch('/api/coach/pending-requests-count')
      .then((r) => (r.ok ? r.json() : { total: 0 }))
      .then((data) => setCount(Number(data?.total ?? 0)))
      .catch(() => setCount(0));
  }, [enabled]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onRefresh = () => refresh();
    window.addEventListener('coach-pending-refresh', onRefresh);
    return () => window.removeEventListener('coach-pending-refresh', onRefresh);
  }, [refresh]);

  return [count, refresh] as const;
}
