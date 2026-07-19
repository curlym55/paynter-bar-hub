/* Paynter Bar Hub — service worker (main Hub app, scope: /)
 * Deliberately conservative: this app shows live Square / Supabase data,
 * so nothing under /api/ is ever cached. Only static build assets and the
 * offline fallback page are stored.
 *
 * Separate from public/sw.js (the roster app's service worker, scope:
 * /roster) so the two PWAs' caches and lifecycles never interfere with
 * each other. Bump CACHE_VERSION whenever you change this file.
 */

const CACHE_VERSION = 'pbh-hub-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline-hub.html';

const PRECACHE = [
  OFFLINE_URL,
  '/manifest-hub.json',
  '/icons/icon-hub-192.png',
  '/icons/icon-hub-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('pbh-hub-') && !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch anything that isn't a plain GET from our own origin.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Live data must always come from the network.
  if (url.pathname.startsWith('/api/')) return;

  // Don't shadow the roster app's own scope/cache.
  if (url.pathname.startsWith('/roster')) return;

  // Immutable build output — cache first, it's content-hashed.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Icons / manifest / other public assets — cache first, refresh in background.
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest-hub.json') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Page navigations — network first, fall back to the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error())
      )
    );
  }
});
