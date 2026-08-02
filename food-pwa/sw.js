// Kicken Bites Service Worker v8 — NETWORK-FIRST, self-updating
// Bump this number on every deploy to force every device onto the newest files.
const SW_VERSION = 'kb-v10';
const CACHE = SW_VERSION;

// Install: take over immediately, don't wait for old tabs to close.
self.addEventListener('install', e => { self.skipWaiting(); });

// Activate: delete ALL old caches, claim all open pages, then tell every page to
// reload once so they drop the old cached HTML/JS the previous SW was serving.
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));   // wipe every old cache
    await self.clients.claim();                           // control open pages now
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) {
      // Ask each page to hard-reload so it fetches the fresh files.
      c.postMessage({ type: 'SW_UPDATED', version: SW_VERSION });
    }
  })());
});

// Fetch: ALWAYS go to the network first (fresh files every load). Only fall back to
// cache when offline. Firestore/API calls are never cached. This is why a new deploy
// shows up immediately without needing ?v= or manual cache clearing.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  // Never touch Firebase/Firestore/Google APIs — let them pass straight through.
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebaseio.com') ||
      url.includes('googleapis.com') ||
      url.includes('gstatic.com')) {
    return; // default browser handling
  }
  // IMAGES: cache-first. Every GET used to go through the network-first branch
  // below with cache:'no-store', so the food photos were re-downloaded in full on
  // every single page load — that is the delay before the pictures appear. Image
  // URLs (imgbb + our own logo) are immutable: the same URL always returns the
  // same bytes, so serving them from cache is safe and instant. A new photo gets
  // a brand-new URL and is fetched normally the first time.
  const isImage = e.request.destination === 'image' ||
                  /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url) ||
                  url.includes('i.ibb.co') || url.includes('ibb.co');
  // REGRESSION FIX (collage): the pages show food photos with a plain <img src>,
  // which is a no-cors request, so what lands in the cache is an OPAQUE response.
  // The admin collage asks for the SAME url with crossOrigin='anonymous' (a cors
  // request), and caches.match() matches on URL alone — so it handed the collage
  // that opaque response. A cors image request cannot use an opaque response, so
  // every photo failed and the collage fell back to the 🍛 emoji. Let cors image
  // requests go straight to the network, untouched by this worker.
  if (isImage && e.request.mode === 'cors') return;
  if (isImage) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      try {
        const fresh = await fetch(e.request);
        try { const cache = await caches.open(CACHE); cache.put(e.request, fresh.clone()); } catch (_) {}
        return fresh;
      } catch (_) {
        return new Response('', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    try {
      const fresh = await fetch(e.request, { cache: 'no-store' });
      // keep a copy for offline use
      try { const cache = await caches.open(CACHE); cache.put(e.request, fresh.clone()); } catch (_) {}
      return fresh;
    } catch (_) {
      const cached = await caches.match(e.request);
      return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});

// ---- Background order check (unchanged behaviour) ----
let checkInterval = null;
let lastKnownStatuses = {};

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'START_BG_CHECK') {
    const {projectId, apiKey, date} = e.data;
    startBackgroundCheck(projectId, apiKey, date);
  }
  if (e.data && e.data.type === 'STOP_BG_CHECK') { stopBackgroundCheck(); }
  if (e.data && e.data.type === 'UPDATE_STATUSES') { lastKnownStatuses = e.data.statuses || {}; }
  // Let a page manually trigger the newest SW to take over.
  if (e.data && e.data.type === 'SKIP_WAITING') { self.skipWaiting(); }
});

function startBackgroundCheck(projectId, apiKey, date) {
  stopBackgroundCheck();
  checkInterval = setInterval(async () => {
    try {
      const clients = await self.clients.matchAll();
      const hasFocused = clients.some(c => c.focused);
      if (hasFocused) return;
      await checkForNewOrders(projectId, apiKey, date);
    } catch(e) { console.error('BG check error:', e); }
  }, 15000);
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
          fieldFilter: { field: {fieldPath: 'date'}, op: 'EQUAL', value: {stringValue: date} }
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
