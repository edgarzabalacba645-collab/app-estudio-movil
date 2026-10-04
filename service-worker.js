// Service worker v2.
//
// Qué cambió respecto a la v1: la v1 respondía PRIMERO desde el caché y recién
// después iba a la red, y el caché nunca se renovaba -- así quedaban "pegadas"
// versiones viejas de la página (la app instalada abría una copia vieja aunque
// el sitio ya estuviera actualizado).
//
// Ahora: SIEMPRE intenta traer la versión más nueva desde la red (revalidando
// contra el servidor), y usa lo guardado SOLO si no hay conexión. Las llamadas a
// Supabase/Gemini y los CDNs externos no pasan por acá.
//
// Para forzar que todos los celulares descarten lo guardado en una versión
// futura, basta con subir el número de VERSION.

const VERSION = "v2";
const CACHE_NOMBRE = `estudio-ia-${VERSION}`;
const CASCARON = [
  "./index.html",
  "./movil_estudio.html",
  "./movil_vinculacion_qr.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOMBRE).then((cache) =>
      // Archivo por archivo: si uno falla no se cae toda la instalación.
      // cache:"reload" saltea el caché HTTP, para no guardar copias viejas.
      Promise.all(
        CASCARON.map((url) =>
          fetch(new Request(url, { cache: "reload" }))
            .then((resp) => (resp.ok ? cache.put(url, resp) : null))
            .catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(nombres.filter((n) => n !== CACHE_NOMBRE).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

function pedirALaRed(pedido) {
  // "no-cache" = preguntarle al servidor si cambió (barato si no cambió).
  return fetch(pedido.url, { cache: "no-cache" }).then((resp) => {
    // Un pedido de navegación no admite una respuesta ya redirigida: en ese
    // caso se repite el pedido original y que el navegador siga la redirección.
    if (pedido.mode === "navigate" && resp.redirected) return fetch(pedido);
    return resp;
  });
}

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  if (pedido.method !== "GET" || url.origin !== self.location.origin) return;

  evento.respondWith(
    pedirALaRed(pedido)
      .then((resp) => {
        // Se guarda solo lo "limpio": sin parámetros en la URL (así no queda
        // guardado el token de vinculación del QR) y sin redirecciones.
        if (resp.ok && resp.type === "basic" && !resp.redirected && url.search === "") {
          const copia = resp.clone();
          caches.open(CACHE_NOMBRE).then((cache) => cache.put(pedido, copia));
        }
        return resp;
      })
      .catch(() =>
        // Sin conexión: lo último que se guardó; y para abrir la app, el index.
        caches
          .match(pedido, { ignoreSearch: true })
          .then((guardado) => guardado || (pedido.mode === "navigate" ? caches.match("./index.html") : undefined))
      )
  );
});
