// Cuaderno Turpial: funciona sin internet. Sube el número de versión al publicar cambios.
const V='turpial-v5';
const FILES=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).pathname.startsWith('/api/'))return;
  e.respondWith(caches.match(e.request).then(r=>{
    const net=fetch(e.request).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(e.request,cp));}return res;}).catch(()=>r);
    return r||net;
  }));
});
