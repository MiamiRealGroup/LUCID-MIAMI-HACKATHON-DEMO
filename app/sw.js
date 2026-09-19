// Offline-first service worker. Caches the app shell on install and
// cached audio clips at runtime, so the entire AAC board works without
// a connection.

// Bump this whenever ANY cached asset changes. The activate handler deletes
// every other cache — the only way a browser that already visited stops
// serving the old CSS/JS.
const CACHE = 'lucid-v5';
// URLs must match exactly what index.html requests, including the ?v= query,
// or the precache misses and the first offline load fails.
const SHELL = [
  '/',
  '/index.html',
  '/css/base.css?v=5',
  '/css/grid.css?v=5',
  '/js/main.js',
  '/js/speak.js',
  '/js/board.js',
  '/js/context.js',
  '/js/caregiver.js',
  '/manifest.webmanifest',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for API (so a fresh manifest is used when online), but
// fall back to cache when offline. Audio and shell are cache-first.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept the audio stream or non-GET requests.
  if (event.request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.startsWith('/audio/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    // Offline and not cached: return the app shell for navigation.
    if (request.mode === 'navigate') return cache.match('/index.html');
    return new Response('', { status: 504 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    return hit || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
}
