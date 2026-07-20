// Kicken Bites Service Worker v7
// Handles background sync and notifications
const CACHE = 'kb-v7';
const FIREBASE_URL = 'https://firestore.googleapis.com';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

// Always fetch fresh - no caching
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)||new Response('Offline')));
});

// Background sync - check orders every 30 seconds when tab is hidden
let checkInterval = null;
let lastKnownStatuses = {};

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'START_BG_CHECK') {
    const {projectId, apiKey, date} = e.data;
    startBackgroundCheck(projectId, apiKey, date);
  }
  if (e.data && e.data.type === 'STOP_BG_CHECK') {
    stopBackgroundCheck();
  }
  if (e.data && e.data.type === 'UPDATE_STATUSES') {
    lastKnownStatuses = e.data.statuses || {};
  }
});

function startBackgroundCheck(projectId, apiKey, date) {
  stopBackgroundCheck();
  checkInterval = setInterval(async () => {
    try {
      const clients = await self.clients.matchAll();
      // Only check if no focused clients (tab in background or closed)
      const hasFocused = clients.some(c => c.focused);
      if (hasFocused) return;
      
      await checkForNewOrders(projectId, apiKey, date);
    } catch(e) { console.error('BG check error:', e); }
  }, 15000); // Check every 15 seconds
}

function stopBackgroundCheck() {
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}

async function checkForNewOrders(projectId, apiKey, date) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
    const body = {
      structuredQuery: {
        from: [{collectionId: 'orders'}],
        where: {
          fieldFilter: {
            field: {fieldPath: 'date'},
            op: 'EQUAL',
            value: {stringValue: date}
          }
        }
      }
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!Array.isArray(data)) return;
    
    for (const item of data) {
      if (!item.document) continue;
      const fields = item.document.fields || {};
      const id = item.document.name.split('/').pop();
      const status = fields.status?.stringValue || '';
      const name = fields.name?.stringValue || 'Customer';
      const total = fields.total?.integerValue || fields.total?.doubleValue || 0;
      const prevStatus = lastKnownStatuses[id];
      
      if (prevStatus && prevStatus !== status) {
        if (prevStatus === 'pending_payment' && status === 'confirmed') {
          await showBgNotification('💰 Payment Confirmed!', `${name} paid ₹${total}`, id);
        } else if (status === 'delivered') {
          await showBgNotification('✅ Order Delivered!', `${name}\'s order delivered! ₹${total}`, id);
        }
      }
      if (!prevStatus && status === 'pending_payment') {
        await showBgNotification('🔔 New Order!', `New order from ${name} — ₹${total}`, id);
      }
      lastKnownStatuses[id] = status;
    }
  } catch(e) { console.error('Firestore check error:', e); }
}

async function showBgNotification(title, body, orderId) {
  await self.registration.showNotification(title, {
    body: body,
    icon: '/KickenBites/food-pwa/icon-192.png',
    badge: '/KickenBites/food-pwa/icon-192.png',
    tag: 'order-' + orderId,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    data: { orderId }
  });
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
      const adminClient = clients.find(c => c.url.includes('admin.html'));
      if (adminClient) return adminClient.focus();
      return self.clients.openWindow('/KickenBites/food-pwa/admin.html');
    })
  );
});
