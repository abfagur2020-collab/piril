// Sayfa ağdan önce denenir (3 sn), olmazsa önbellekten açılır; internet varken her açılış en yeni sürümdür.
const CACHE = 'piril-d8aac88db1';
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
  // İkon ve manifest önbellekten gelir, arkadan yenilenir; eski kopya bir sonraki açılışta düzelir.
  const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; });
  e.waitUntil(net.catch(() => {}));
  e.respondWith(caches.match(e.request, { cacheName: CACHE }).then(r => r || net));
});

/* ---------- Hatırlatıcı: tarayıcı arka planda çağırır (Android, kurulu uygulama) ---------- */
// d: sayfanın yazdığı özet, sent: son bildirimin günü. Gönderilmeyecekse null döner.
function reminderText(d, today, hour, sent, rnd) {
  if (!d || !d.rem || hour < 9 || hour >= 22) return null;
  if (sent != null && today - sent < d.rem) return null;
  const xp = d.day === today ? d.dayXp : 0;
  if (xp >= d.goal) return null;
  const gap = today - d.last, alive = d.last >= 0 && (gap <= 1 || (gap === 2 && d.freeze));
  if (alive && gap >= 1 && d.streak > 1) return `${d.streak} günlük serin var. Bugün bir ders çöz, bozulmasın.`;
  if (xp > 0) return `Hedefe ${d.goal - xp} XP kaldı. Kısa bir ders yeter.`;
  if (d.wrong > 0) return `Tekrar kutunda ${d.wrong} soru seni bekliyor.`;
  const any = ['Bugün daha devre kurmadın. 3 dakikan var mı?', 'Kondansatör dolu, sıra sende: günün dersi hazır.', 'Elektronlar seni bekliyor. Kısa bir ders?', 'Bugünkü akımını almadın. Bir ders, 3 dakika.'];
  return any[Math.floor(rnd * any.length)];
}
async function remind() {
  const c = await caches.open('akimli-durum'), r = await c.match('durum'), s = await c.match('gonderildi');
  const now = new Date(), today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5);
  const body = reminderText(r && await r.json(), today, now.getHours(), s ? +(await s.text()) : null, Math.random());
  if (!body) return;
  await self.registration.showNotification('Akımlı', { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'hatirlat' });
  await c.put('gonderildi', new Response(String(today)));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'hatirlat') e.waitUntil(remind()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(w => w.length ? w[0].focus() : clients.openWindow('./')));
});
