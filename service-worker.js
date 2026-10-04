// Service worker mínimo: solo lo necesario para que Chrome ofrezca instalar
// la app, y para que el cascarón (HTML/íconos) cargue aunque no haya señal.
// Las llamadas reales a Supabase/Gemini siguen necesitando conexión -- esto
// no las cachea ni las reemplaza.

const CACHE_NOMBRE = "estudio-ia-v1";
const ARCHIVOS_CASCARON = [
  "./movil_estudio.html",
  "./movil_vinculacion_qr.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOMBRE).then((cache) => cache.addAll(ARCHIVOS_CASCARON))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NOMBRE)
          .map((nombre) => caches.delete(nombre))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  // Solo intervenimos pedidos propios (mismo origen) del cascarón; todo lo
  // demás (Supabase, CDNs externos) pasa directo a la red, sin cachear.
  if (evento.request.method !== "GET" || new URL(evento.request.url).origin !== self.location.origin) {
    return;
  }
  evento.respondWith(
    caches.match(evento.request).then((respuestaCache) => {
      return (
        respuestaCache ||
        fetch(evento.request).then((respuestaRed) => {
          const copia = respuestaRed.clone();
          caches.open(CACHE_NOMBRE).then((cache) => cache.put(evento.request, copia));
          return respuestaRed;
        })
      );
    })
  );
});
