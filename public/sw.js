// Signature CRM — Service Worker v2
// Strategy: Cache-First for static assets, Network-First for API

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `crm-static-${CACHE_VERSION}`;
const API_CACHE = `crm-api-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ─── Install: Pre-cache static shell ───────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // Activate immediately
});

// ─── Activate: Delete old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: Routing strategies ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET & non-http(s) requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // API calls → Network First, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static JS/CSS/Images → Cache First, fallback to network
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML Navigation → Network First, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/') // Offline fallback to app shell
      )
    );
    return;
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Push Notifications ────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  try {
    const data = event.data?.json() ?? { title: 'Signature CRM', body: 'New update' };
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: data.url || '/' },
        vibrate: [100, 50, 100],
        actions: [{ action: 'open', title: 'Open App' }],
        tag: 'crm-notification', // Replace duplicate notifications
        renotify: true,
      })
    );
  } catch (err) {
    console.error('[SW] Push error:', err);
  }
});

// ─── Notification Click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(c => c.url === urlToOpen && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(urlToOpen);
    })
  );
});
