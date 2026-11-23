// Sayfa ağdan önce denenir (3 sn), olmazsa önbellekten açılır; internet varken her açılış en yeni sürümdür.
const CACHE = 'piril-b1ab5b4693';
const FILES = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('piril-') && x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    const net = fetch(e.request.url, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw r;
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put('./', copy));
      return r;
    });
    const late = new Promise((_, no) => setTimeout(no, 3000));
    e.respondWith(Promise.race([net, late]).catch(() => caches.match('./').then(r => r || net)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
