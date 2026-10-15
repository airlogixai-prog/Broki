/* AIRLOGIX public PWA — version broki-public-v1
 * Caches static assets only. Never caches /broki API or authenticated routes.
 */
const CACHE = "airlogix-static-v1";
const PRECACHE = ["/", "/offline", "/images/logo_3.png", "/images/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // Never intercept private dashboard or Supabase
  if (
    url.pathname.startsWith("/broki") ||
    url.pathname.includes("/functions/") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ??
        fetch(event.request).then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put(event.request, copy));
          return res;
        }),
      ),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => res)
        .catch(() => caches.match("/offline").then((r) => r ?? caches.match("/"))),
    );
  }
});
