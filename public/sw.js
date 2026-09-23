// Service worker minimo: solo habilita que Chrome/Android ofrezca instalar
// la app (criterio de PWA instalable). No cachea nada para no complicar
// la persistencia de datos, que vive siempre en el servidor/Supabase.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
