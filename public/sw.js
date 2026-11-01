const CACHE_NAME = 'yolocycling-cache-v2';
const TILE_CACHE_NAME = 'yolocycling-tiles-v2';
const MAX_CACHED_TILES = 300;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_NAME, TILE_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !allowedCaches.includes(name))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Trim cache to maximum items (LRU style)
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const toDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(toDelete.map((key) => cache.delete(key)));
    }
  } catch (err) {
    // Ignore trim errors
  }
}

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Open-Meteo Weather API: Network only (live data, don't cache stale forecast)
  if (url.origin.includes('open-meteo.com')) {
    return;
  }

  // 2. Map Tiles: Cache-First with background refresh & LRU limit (OSM, Esri Topo/Satellite, OpenTopo)
  const isMapTile =
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    url.hostname.includes('opentopomap.org');

  if (isMapTile) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone());
            trimCache(TILE_CACHE_NAME, MAX_CACHED_TILES);
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse || new Response('', { status: 408, statusText: 'Tile Unavailable Offline' });
        }
      })
    );
    return;
  }

  // 3. Google Fonts: Cache-First for typography offline
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // 4. SPA Navigation requests (HTML): Network first, fallback to cached /index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedApp = await caches.match('/index.html');
        return cachedApp || caches.match('/');
      })
    );
    return;
  }

  // 5. Stale-While-Revalidate for app assets and scripts
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
