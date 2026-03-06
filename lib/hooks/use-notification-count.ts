'use client';

import { useState, useEffect, useCallback } from 'react';

export function useNotificationCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    if (!enabled) return;
    fetch('/api/notifications?count=true')
      .then((r) => r.ok ? r.json() : { count: 0 })
      .then((data) => setCount(data?.count ?? 0))
      .catch(() => setCount(0));
  }, [enabled]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return [count, refresh] as const;
}
