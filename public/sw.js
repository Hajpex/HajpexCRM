// Hajpex CRM — service worker
// Strategi: network-first med cache-fallback (offline).
// Cachar ENDAST statiska same-origin GET-svar utan query, så Vites
// dev/HMR-moduler (?v=, ?t=, /@vite, /@id) aldrig cachas → bryter inte dev.

const CACHE = "hajpex-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isCacheable(url) {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return false;
  if (u.search) return false;                         // hoppa över vite ?v= / ?t= / ?import
  if (u.pathname.startsWith("/@")) return false;      // vite-internt (@vite, @id, @fs)
  if (u.pathname.includes("/node_modules/")) return false;
  if (u.pathname.endsWith(".map")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && isCacheable(req.url)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === "navigate") return caches.match("/");
          return Response.error();
        })
      )
  );
});
