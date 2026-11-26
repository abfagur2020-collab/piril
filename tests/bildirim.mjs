// Bildirim (telefon tarafı): gerçek service worker sunucudan gelen push'u bildirim olarak gösterir; hatırlatıcı
// açılınca arka plan kontrolü olmayan cihazda giriş istenir, girişliyse abonelik Firestore belgesine (p) yazılır.
// Çalıştır: node tests/bildirim.mjs
import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(new URL(q.url, 'http://x').pathname === '/' ? '/index.html' : new URL(q.url, 'http://x').pathname));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ channel: 'chromium' }), errors = []; // headless shell bildirim göstermez, tam Chromium gerekir
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['notifications'] });
  await ctx.addInitScript(() => localStorage.setItem('piril-hos', '1'));
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url); await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.evaluate(() => navigator.serviceWorker.ready);

  // 1. Sunucudan gelen push → bildirim (CDP ile gerçek SW'ye teslim)
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('ServiceWorker.enable');
  const regId = await new Promise(res => { cdp.on('ServiceWorker.workerRegistrationUpdated', e => e.registrations.forEach(r => !r.isDeleted && res(r.registrationId))); });
  await cdp.send('ServiceWorker.deliverPushMessage', { origin: url.slice(0, -1), registrationId: regId, data: JSON.stringify({ title: 'Akımlı', body: '5 günlük serin var. Bugün bir ders çöz, bozulmasın.' }) });
  let n = [];
  for (let i = 0; i < 50 && !n.length; i++) { await page.waitForTimeout(100); n = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map(x => [x.title, x.body, x.tag])); }
  assert.deepEqual(n[0], ['Akımlı', '5 günlük serin var. Bugün bir ders çöz, bozulmasın.', 'hatirlat'], 'push bildirimi gösterildi');
  console.log('ok  push → bildirim:', n[0][1]);

  // 2. Girişsiz: hatırlatıcı açılınca giriş istenir (arka plan kontrolü yok → sunucu bildirimi)
  await page.evaluate(() => { PushManager.prototype.getSubscription = async () => window.__sub || null;
    PushManager.prototype.subscribe = async o => (window.__sub = { o, toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: async () => { window.__sub = null; return true; } }); });
  await page.evaluate(() => location.hash = 'profil'); await page.waitForSelector('#rem');
  await page.selectOption('#rem', '1');
  await page.waitForFunction(() => /Google ile giriş yap/.test(document.querySelector('#remst').textContent));
  assert.equal(await page.evaluate(() => document.querySelector('#remst').classList.contains('err')), false);
  console.log('ok  girişsiz: giriş yönlendirmesi');

  // 3. Girişli (sahte Firestore): abonelik kurulur, belgeye p yazılır, yedek yazımı merge ile p'yi silmez
  await page.evaluate(() => { window.__w = []; cloudUser = { uid: 'u1' };
    cloud = { db: {}, fs: { doc: (d, c, id) => c + '/' + id, getDoc: async () => ({ exists: () => false }), setDoc: async (ref, v, o) => window.__w.push({ ref, v, o }) } }; });
  await page.selectOption('#rem', '0'); await page.selectOption('#rem', '2');
  await page.waitForFunction(() => /20\.00/.test(document.querySelector('#remst').textContent));
  const w = await page.evaluate(() => window.__w.map(x => ({ ref: x.ref, keys: Object.keys(x.v), merge: x.o?.merge, p: x.v.p })));
  const pw = w.find(x => x.keys.join() === 'p' && x.p);
  assert.ok(pw && pw.ref === 'users/u1' && pw.merge && JSON.parse(pw.p).endpoint === 'https://push.example/abc', 'abonelik belgeye yazıldı');
  assert.ok(w.filter(x => x.keys.includes('s')).every(x => x.merge), 'yedek yazımı merge');
  assert.equal(await page.evaluate(() => window.__sub.o.applicationServerKey.length), 65, 'VAPID anahtarı 65 bayt');
  console.log('ok  girişli: abonelik Firestore\'a yazıldı');

  // 4. Kapatınca abonelik silinir ve p boşaltılır
  await page.evaluate(() => window.__w = []); await page.selectOption('#rem', '0');
  await page.waitForFunction(() => window.__w.some(x => x.v.p === ''));
  assert.equal(await page.evaluate(() => window.__sub), null);
  console.log('ok  kapatınca abonelik silindi');
  assert.deepEqual(errors, []);
  console.log('Hepsi geçti');
} catch (e) { console.error('BAŞARISIZ:', e.message, errors); process.exitCode = 1; }
finally { await browser.close(); srv.close(); }
