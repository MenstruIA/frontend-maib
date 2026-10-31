/* Service worker MenstruAI : lecture hors ligne du contenu public uniquement.
   Jamais mis en cache : assistant, signalements, administration (données sensibles ou authentifiées).
   v2 : les pages (navigation) sont servies « réseau d'abord » pour que les mises à jour de l'application
   arrivent sans attendre ; le cache ne sert que de secours hors ligne. */
const VERSION = 'menstruai-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/logo.png'];
const CACHEABLE_API = /\/api\/v1\/(content|categories|services)(\/|\?|$)/;

self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const store = (req, res) => { if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; };

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/admin') || /assistant|feedback/.test(url.pathname)) return; // réseau direct, pas de cache

  // API publique : réseau d'abord, copie locale en secours hors ligne.
  if (CACHEABLE_API.test(url.pathname + url.search)) {
    event.respondWith(fetch(req).then((res) => store(req, res)).catch(() => caches.match(req).then((hit) => hit || new Response(JSON.stringify({ data: [] }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }

  // Pages : réseau d'abord (nouvelle version immédiatement visible), cache de secours.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => { if (res.ok) store('/', res); return res; }).catch(() => caches.match('/').then((hit) => hit || Response.error())));
    return;
  }

  // Ressources de même origine (JS/CSS/images hachés) : cache puis mise à jour en arrière-plan.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      const network = fetch(req).then((res) => store(req, res)).catch(() => hit || Response.error());
      return hit || network;
    }));
  }
});
