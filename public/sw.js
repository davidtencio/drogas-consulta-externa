// Service worker mínimo para que la interfaz cargue sin conexión (app shell).
// No toca peticiones a Firestore/Google (otro origen): esas van a la red y
// Firestore maneja su propio offline por IndexedDB.
// La versión viene en la URL (?v=<build>), así cada despliegue usa una caché
// nueva y descarta las anteriores en "activate".
const VERSION = new URL(self.location.href).searchParams.get("v") || "v1";
const CACHE = "drogas-cache-" + VERSION;

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Solo mismo origen: las llamadas a Firestore/Auth (otro origen) pasan directo.
  if (url.origin !== self.location.origin) return;

  // Navegaciones: red primero, con respaldo al app shell cacheado si no hay red.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Estáticos (JS/CSS/imágenes): caché primero, actualizando en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
