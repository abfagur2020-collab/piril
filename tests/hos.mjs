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
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  // 1. İlk açılış: Pırıl ve iki seçenek
  await page.waitForSelector('.hos');
  assert.match(await page.textContent('h1'), /Pırıl/);
  assert.equal(await page.locator('[data-h]').count(), 2);
  // 2. Yeni yol: kaydol + hesapsız başla
  await page.click('[data-h="1"]');
  assert.match(await page.textContent('h1'), /kaydol/i);
  assert.equal(await page.locator('#hin').count(), 1);
  await page.click('#hskip');
  await page.waitForSelector('.pcb');
  assert.equal(await page.evaluate(() => localStorage.getItem('piril-hos')), '1');
  // 3. Bir kez: yeniden yüklenince ana sayfa
  await page.reload(); await page.waitForSelector('.pcb');
  assert.equal(await page.locator('.hos').count(), 0);
  // 4. Hesabım var: Google girişi (sahte) başarılı olunca ana sayfa
  await page.evaluate(() => { localStorage.removeItem('piril-hos'); cloudSignIn = async () => {}; route(); });
  await page.click('[data-h="2"]');
  await page.click('#hin'); await page.waitForSelector('.pcb');
  // 5. Giriş başarısızsa mesaj, ekran kalır
  await page.evaluate(() => { localStorage.removeItem('piril-hos'); cloudSignIn = async () => { const x = new Error('popup'); x.code = 'akimli/popup'; throw x; }; route(); });
  await page.click('[data-h="2"]'); await page.click('#hin');
  await page.waitForFunction(() => /Safari veya Chrome/.test(document.querySelector('#hmsg').textContent));
  assert.equal(await page.locator('.hos').count(), 1);
  // 6. Doğrudan ders adresi hoş geldin ekranını atlar
  await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q);
  assert.deepEqual(errors, []);
  console.log('Hepsi geçti');
} catch (e) { console.error('BAŞARISIZ:', e.message, errors); process.exitCode = 1; }
finally { await browser.close(); }
