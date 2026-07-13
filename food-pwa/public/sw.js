// Cache version — increment this to force all users to get fresh files
const CACHE_VERSION = 'food-pwa-v5';

self.addEventListener('install', e => {
  // Skip waiting — activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete ALL old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Always fetch from network — never serve from cache
  // This ensures users always get latest files
  e.respondWith(
    fetch(e.request).catch(() => {
      // Only fall back to cache if network fails completely
      return caches.match(e.request);
    })
  );
});
