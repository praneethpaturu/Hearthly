// Lightweight service worker — caches the shell so the app launches offline.
const CACHE = 'valet-v2';
const PRECACHE = [
  '/', '/index.html',
  '/resident.html', '/agent.html', '/admin.html',
  '/app.css', '/api.js',
  '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // Never cache API or websocket — always go to network.
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/socket.io/')) return;
  if (e.request.method !== 'GET') return;

  // Network-first for HTML, cache-first for static assets.
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html')))
    );
  } else {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
      return res;
    })));
  }
});
