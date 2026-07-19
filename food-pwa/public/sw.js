// Kicken Bites Service Worker v6 — Background notifications
const CACHE = 'food-pwa-v6';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

// Always fetch from network
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});

// Handle push notifications (from server)
self.addEventListener('push', e => {
  if(!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title||'Kicken Bites', {
      body: data.body||'',
      icon: '/KickenBites/food-pwa/icon-192.png',
      badge: '/KickenBites/food-pwa/icon-192.png',
      requireInteraction: true,
      data: data
    })
  );
});

// Notification click - focus the window
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(cls=>{
    const c = cls.find(c=>c.url.includes('admin.html'));
    if(c) return c.focus();
    return clients.openWindow('/KickenBites/food-pwa/admin.html');
  }));
});
