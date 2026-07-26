const CACHE_NAME = 'procut-cache-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests with http/https schemes
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }

  // Bypass caching for WebSockets, Puter APIs, local editor backend APIs, or media range requests
  if (e.request.url.includes('socket.io') || e.request.url.includes('api.puter.com') || e.request.url.includes('/api/') || e.request.headers.get('range')) {
    return;
  }

  // Use Network First, falling back to cache for HTML navigation requests
  if (e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
    e.respondWith(
      fetch(e.request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          }).catch(err => console.warn('Cache put navigation failed:', err));
        }
        return response;
      }).catch(() => {
        return caches.match(e.request).then(cached => cached || Response.error());
      })
    );
    return;
  }

  // Use Cache First, falling back to Network for assets (JS, CSS, images, etc.)
  e.respondWith(
    caches.match(e.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(e.request).then((fetchRes) => {
        // Do not cache partial responses (206) or error responses
        if (fetchRes.status === 200) {
          const responseClone = fetchRes.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          }).catch(err => console.warn('Cache put asset failed:', err));
        }
        return fetchRes;
      }).catch((err) => {
        // Propagate fetch errors naturally so the browser knows the request failed
        throw err;
      });
    }).catch(() => {
      // Fallback if match fails
      return fetch(e.request);
    })
  );
});
