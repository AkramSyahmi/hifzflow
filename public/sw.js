/**
 * HifzFlow service worker.
 *
 * Hand written rather than generated. The reason is that the caching strategy
 * here is not uniform — the app has three classes of resource with genuinely
 * different correctness requirements, and a generated worker would either
 * flatten them or need as much configuration as this file is long.
 *
 *   Build assets      immutable, content-hashed. Cache first, forever.
 *   Reference data    the Quran index never changes. Cache first, forever.
 *   Everything else   user data. Network first, cache only as a fallback so
 *                     the app opens offline showing what it last knew.
 *
 * Writes are never intercepted. A POST replayed by a service worker is a POST
 * the application does not know happened, and reconciling that is worse than
 * the problem it solves. Offline writes are handled in the application layer by
 * the outbox, where they are visible and can be retried deliberately.
 */

const VERSION = 'v1';
const SHELL_CACHE = `hifzflow-shell-${VERSION}`;
const ASSET_CACHE = `hifzflow-assets-${VERSION}`;
const PAGE_CACHE = `hifzflow-pages-${VERSION}`;

const OFFLINE_URL = '/offline';

/**
 * The minimum needed to render something useful with no network. Deliberately
 * short: a long precache list makes installation fragile, because one missing
 * entry fails the whole install and the worker never activates.
 */
const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Added individually so one failure does not abort the install.
      await Promise.allSettled(
        SHELL_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('hifzflow-') && !key.endsWith(VERSION))
          .map((key) => caches.delete(key))
      );

      // Navigation preload lets the browser start the network request while the
      // worker is still booting, which removes the startup cost this worker
      // would otherwise add to every navigation.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }

      await self.clients.claim();
    })()
  );
});

/** Content-hashed build output and generated icons. Safe to keep indefinitely. */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico'
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/**
 * Network first, falling back to the last successful response for the same URL.
 *
 * Serving a stale page is the right trade here because the day's murajaah queue
 * is generated once and then fixed — a stale copy is the same plan, not a wrong
 * one. Anything genuinely time-sensitive is re-fetched the moment the network
 * returns.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const preloaded = await request.preloadResponse;
    const response = preloaded || (await fetch(request));
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is ever served from cache. Server Actions, auth callbacks and RPC
  // calls all pass straight through, which is what keeps this worker from
  // silently duplicating a write.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Third-party origins are none of this worker's business.
  if (url.origin !== self.location.origin) return;

  // Auth flows must never be served stale: a cached callback would replay a
  // consumed one-time code.
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/')) {
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }

  // Fonts and other same-origin static files.
  if (request.destination === 'font' || request.destination === 'style') {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});

/**
 * Lets the page tell the worker to take over immediately after an update,
 * rather than waiting for every tab to close.
 */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') {
    self.skipWaiting();
  }
});
