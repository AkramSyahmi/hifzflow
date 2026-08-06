'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the browser believes it has a connection.
 *
 * `navigator.onLine` is famously optimistic — it reports true for a captive
 * portal or a router with no upstream — so it is treated as a hint rather than
 * a guarantee. Every write still attempts the network and falls back to the
 * outbox on failure, which means a wrong answer here costs a retry instead of
 * losing data.
 *
 * Starts as true so the first render matches the server, avoiding a hydration
 * mismatch and a flash of the offline banner on every load.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
