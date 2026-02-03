'use client';

import { useState, useEffect } from 'react';

export function useNotificationCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    fetch('/api/notifications?count=true')
      .then((r) => r.ok ? r.json() : { count: 0 })
      .then((data) => setCount(data?.count ?? 0))
      .catch(() => setCount(0));
  }, [enabled]);
  return count;
}
