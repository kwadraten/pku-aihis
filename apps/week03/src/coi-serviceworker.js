// Scoped to this week's directory. No caching of user files or model requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
  event.respondWith(
    fetch(req).then((r) => {
      if (r.status === 0) return r;
      const h = new Headers(r.headers);
      h.set("Cross-Origin-Opener-Policy", "same-origin");
      h.set("Cross-Origin-Embedder-Policy", "credentialless");
      h.set("Cross-Origin-Resource-Policy", "cross-origin");
      return new Response(r.body, {
        status: r.status,
        statusText: r.statusText,
        headers: h,
      });
    }),
  );
});
