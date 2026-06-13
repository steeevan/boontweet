// service-worker.js — makes BoonTweet installable + work offline / load faster.
// Strategy:
//   - cross-origin (CDN fonts/React/Babel, flags, thumbnails, linked images):
//     NOT intercepted — the browser loads them normally. (Fetching them from
//     the SW would be a connect-src request, which our CSP restricts to 'self'.)
//   - /api/*           : never cached (always hit the network — live data)
//   - same-origin shell (html/css/jsx): network-first, fall back to cache,
//     then to the cached index.html (so an offline launch still boots the UI).
const CACHE = 'boontweet-v3';
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

  // Only handle SAME-ORIGIN requests. Cross-origin assets (Google Fonts, unpkg
  // React/Babel, flag images, video thumbnails, externally-linked images) are
  // left to the browser to load normally via their <link>/<script>/<img> tags.
  // We must NOT fetch() them from the SW: that's a connect-src request, which
  // our CSP restricts to 'self' — doing so would fail and break those assets.
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // live data: always network

  // App shell: network-first, fall back to cache, then to the cached index.html.
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
