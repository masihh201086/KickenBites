const CACHE = "food-pwa-v1";
const ASSETS = ["/", "/index.html", "/customer.html", "/admin.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.url.includes("firebasejs") || e.request.url.includes("firebase")) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
