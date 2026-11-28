// Hoş geldin: ilk açılışta Pırıl karşılar; yeni / hesabım var yolları, hesapsız başla, Google girişi (sahte), bir kez gösterilir.
// Çalıştır: node tests/hos.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');

const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href;
const browser = await chromium.launch(), errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // Sahte Google Identity Services (gerçek Google bu ortamda denenemez; köken izni ayrıca tests/gis-koken.mjs ile sınanır)
  await page.route('https://accounts.google.com/gsi/client', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: `window.google = { accounts: { id: {
    initialize(o) { window.__gis = o; },
    renderButton(el, o) { window.__gisopt = o; const b = document.createElement('button'); b.id = 'gmock'; b.textContent = 'Google'; b.onclick = () => window.__gis.callback({ credential: window.__bad ? 'bad' : 'tok' }); el.append(b); } } } };` }));
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  // 1. İlk açılış: Pırıl ve iki seçenek
  await page.waitForSelector('.hos');
  assert.match(await page.textContent('h1'), /Pırıl/);
  assert.equal(await page.locator('[data-h]').count(), 2);
  // 2. Yeni yol: önce günlük hedef ve söz (ayrıntısı tests/hedef.mjs), sonra Google düğmesi (GIS, sahte) + hesapsız başla
  await page.click('[data-h="3"]'); await page.click('[data-g="30"]'); await page.click('[data-h="1"]');
  assert.match(await page.textContent('h1'), /kaydol/i);
  await page.waitForSelector('#gmock');
  assert.equal(await page.evaluate(() => window.__gisopt.text), 'signup_with');
  await page.click('#hskip');
  await page.waitForSelector('.pcb');
  assert.equal(await page.evaluate(() => localStorage.getItem('piril-hos')), '1');
  // 3. Bir kez: yeniden yüklenince ana sayfa
  await page.reload(); await page.waitForSelector('.pcb');
  assert.equal(await page.locator('.hos').count(), 0);
  // 4. Hesabım var: Google düğmesi belge verir, Firebase'e belgeyle girilir, ana sayfa açılır
  await page.evaluate(() => { localStorage.removeItem('piril-hos'); window.__cred = null; cloud = { au: { GoogleAuthProvider: { credential: t => t }, signInWithCredential: async (a, c) => { if (c !== 'tok') throw new Error('x'); window.__cred = c; } }, auth: {} }; cloudP = null; route(); });
  await page.click('[data-h="2"]'); await page.waitForSelector('#gmock');
  assert.equal(await page.evaluate(() => window.__gisopt.text), 'continue_with');
  await page.click('#gmock'); await page.waitForSelector('.pcb');
  assert.equal(await page.evaluate(() => window.__cred), 'tok');
  // 5. Geçersiz belge: mesaj, ekran kalır
  await page.evaluate(() => { localStorage.removeItem('piril-hos'); window.__bad = true; route(); });
  await page.click('[data-h="2"]'); await page.waitForSelector('#gmock'); await page.click('#gmock');
  await page.waitForFunction(() => /tamamlanmadı/.test(document.querySelector('#hmsg').textContent));
  assert.equal(await page.locator('.hos').count(), 1);
  // 5b. Google betiği yüklenemezse yol gösteren mesaj
  await page.unroute('https://accounts.google.com/gsi/client'); await page.route('https://accounts.google.com/gsi/client', r => r.abort());
  await page.evaluate(() => { gisP = null; delete window.google; route(); });
  await page.click('[data-h="2"]');
  await page.waitForFunction(() => /bağlanılamadı/.test(document.querySelector('#hmsg').textContent));
  // 6. Doğrudan ders adresi hoş geldin ekranını atlar
  await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q);
  assert.deepEqual(errors, []);
  console.log('Hepsi geçti');
} catch (e) { console.error('BAŞARISIZ:', e.message, errors); process.exitCode = 1; }
finally { await browser.close(); }
