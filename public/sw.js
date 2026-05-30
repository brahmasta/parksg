/*
 * wheretopark.sg service worker.
 *
 * Deliberately conservative: its main job is to satisfy the PWA
 * installability criteria (a registered SW with a fetch handler) and to
 * give the installed app a fast, offline-tolerant shell — WITHOUT ever
 * serving stale app code after a deploy.
 *
 * Strategy:
 *  - Navigations (HTML)  → network-first, fall back to cached shell offline.
 *  - Same-origin static  → stale-while-revalidate (fast, self-healing).
 *  - /api/* + cross-origin → passthrough (never cached).
 *
 * Bump CACHE_VERSION to invalidate everything on the next activation.
 */
const CACHE_VERSION = 'wtp-v2';
const SHELL_URL = '/';

// Server-rendered SEO pages live at these paths. They must never be cached to
// the app-shell key (an offline '/' should show the SPA shell, not a stale
// carpark page), so we treat them as network-only passthrough. Googlebot
// doesn't run the SW, so this only affects installed-PWA users.
function isSeoRoute(pathname) {
  return (
    pathname.startsWith('/carpark/') ||
    pathname.startsWith('/parking-near/') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt'
  );
}
const PRECACHE = [SHELL_URL, '/icon.svg', '/icon-maskable.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin; never touch API calls or third-party requests.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  // SEO pages are server-rendered and must stay fresh — never cache them.
  if (isSeoRoute(url.pathname)) return;

  // Navigations → network-first so a new deploy is picked up immediately.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(SHELL_URL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL_URL).then((c) => c || Response.error())),
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
