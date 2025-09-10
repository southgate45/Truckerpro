const CACHE = 'tpp-v1';
const ASSETS = ['./','./index.html','./styles.css','./script.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e=>{
  if (e.request.mode==='navigate') e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));
  else e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
