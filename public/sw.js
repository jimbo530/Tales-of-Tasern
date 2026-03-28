const CACHE_NAME = "tot-v2";
const STATS_CACHE = "tot-stats-v2";
const IMAGE_CACHE = "tot-images-v2";

// Cache app shell on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(["/", "/manifest.json", "/icon-192.svg", "/icon-512.svg"])
    )
  );
  self.skipWaiting();
});

// Clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== STATS_CACHE && k !== IMAGE_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Stats API — cache for 24h, serve stale while revalidating
  if (url.pathname === "/api/stats") {
    event.respondWith(
      caches.open(STATS_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          // Check if cached response is less than 24h old
          const cachedTime = cached.headers.get("x-cached-at");
          if (cachedTime && Date.now() - parseInt(cachedTime) < 86400000) {
            // Revalidate in background
            fetch(event.request).then((res) => {
              if (res.ok) {
                const clone = res.clone();
                const headers = new Headers(clone.headers);
                headers.set("x-cached-at", String(Date.now()));
                clone.blob().then((body) => {
                  cache.put(event.request, new Response(body, { status: clone.status, headers }));
                });
              }
            }).catch(() => {});
            return cached;
          }
        }
        // Fetch fresh
        try {
          const res = await fetch(event.request);
          if (res.ok) {
            const clone = res.clone();
            const headers = new Headers(clone.headers);
            headers.set("x-cached-at", String(Date.now()));
            clone.blob().then((body) => {
              cache.put(event.request, new Response(body, { status: clone.status, headers }));
            });
          }
          return res;
        } catch {
          return cached || new Response(JSON.stringify({ error: "offline" }), { status: 503 });
        }
      })
    );
    return;
  }

  // IPFS images — cache forever (they never change)
  if (url.hostname.includes("ipfs") || url.hostname.includes("pinata") || url.hostname.includes("nftstorage") || url.hostname.includes("dweb")) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch {
          return new Response("", { status: 503 });
        }
      })
    );
    return;
  }

  // Everything else — network first, cache fallback
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res.ok && event.request.method === "GET") {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return res;
    }).catch(() => caches.match(event.request))
  );
});
