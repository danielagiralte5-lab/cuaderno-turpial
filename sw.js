// Cuaderno Turpial: funciona sin internet y siempre busca primero la versión nueva.
const V = 'turpial-v15';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/') || u.pathname.endsWith('version.json')) return;
  // La página: primero internet (versión nueva); si no hay conexión, la copia guardada.
  if (e.request.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('.html')) {
    e.respondWith(fetch(e.request, {cache: 'no-store'}).then(res => {
      const cp = res.clone(); caches.open(V).then(c => c.put('index.html', cp)); return res;
    }).catch(() => caches.match('index.html')));
    return;
  }
  // Iconos y demás: copia guardada y se actualiza por detrás.
  e.respondWith(caches.match(e.request).then(r => {
    const net = fetch(e.request).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return res; }).catch(() => r);
    return r || net;
  }));
});
