// service-worker.js — makes BoonTweet installable + work offline / load faster.
// Strategy:
//   - /api/*           : never cached (always hit the network — live data)
//   - cross-origin (CDN: React, Babel, fonts): cache-first (versioned/immutable)
//   - same-origin shell (html/css/jsx): network-first, fall back to cache,
//     then to the cached index.html (so an offline launch still boots).
const CACHE = 'boontweet-v1';
const SHELL = ['/', '/index.html', '/style.css', '/app.jsx', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // never touch mutations
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return; // live data

  if (url.origin !== location.origin) {
    // CDN assets (unpkg, Google Fonts): cache-first.
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Same-origin app shell: network-first with cache fallback.
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
