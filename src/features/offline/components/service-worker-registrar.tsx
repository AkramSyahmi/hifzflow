'use client';

import { useEffect } from 'react';

import { isProduction } from '@/lib/env';

/**
 * Registers the service worker.
 *
 * Production only. In development the worker would serve stale build output
 * between edits, producing changes that appear not to take effect — a
 * genuinely difficult thing to diagnose when you are not expecting it.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!isProduction) return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // A worker waiting to activate means an update is ready. Taking over
        // immediately is safe here because the caches are versioned, so the old
        // ones are discarded rather than mixed with the new.
        if (registration.waiting) {
          registration.waiting.postMessage('skip-waiting');
        }
      } catch {
        // Registration failing is not fatal; the app works online without it.
      }
    };

    void register();
  }, []);

  return null;
}
