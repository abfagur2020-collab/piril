// Kutlama: her doğruda kısa tebrik, 3 doğru arka arkaya tam ekran kutlama; yanlış seriyi sıfırlar; kutlama dokunmayı engellemez.
// Çalıştır: node tests/kutlama.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href, shots = process.argv[2];
const browser = await chromium.launch(), errors = [];
const answer = (page, right) => page.evaluate(right => { const q = C.q;
  C.ans = !right ? (q.t === 'mc' ? (q.a + 1) % q.o.length : q.t === 'sira' ? q.o.map((_, i) => q.o.length - 1 - i) : '999999')
    : q.t === 'mc' || q.t === 'ariza' ? q.a : q.t === 'sira' ? q.o.map((_, i) => i) : String(q.a).replace('.', ','); check(); }, right);
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => localStorage.setItem('piril-hos', '1'));
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q);
  await answer(page, true); await page.waitForTimeout(250);
  assert.equal(await page.locator('.cheer').count(), 1, '1. doğruda tebrik');
  if (shots) await page.screenshot({ path: `${shots}/kutlama-tebrik.png` });
  assert.equal(await page.locator('.party').count(), 0);
  await page.click('#nx'); await answer(page, true); await page.waitForTimeout(100);
  assert.equal(await page.locator('.party').count(), 0, '2. doğruda kutlama yok');
  await page.click('#nx'); await answer(page, true); await page.waitForTimeout(900);
  assert.equal(await page.locator('.party').count(), 1, '3. doğruda kutlama');
  assert.match(await page.textContent('.party'), /3 doğru arka arkaya/);
  if (shots) await page.screenshot({ path: `${shots}/kutlama-3.png` });
  await page.click('#nx', { timeout: 2000 }); // kutlama dokunmayı engellemez
  await page.waitForTimeout(2300);
  assert.equal(await page.locator('.party').count(), 0, 'kutlama kendiliğinden kapanır');
  await answer(page, false); await page.click('#nx');
  assert.equal(await page.evaluate(() => C.combo), 0, 'yanlış seriyi sıfırlar');
  assert.deepEqual(errors, []);
  console.log('Hepsi geçti');
} catch (e) { console.error('BAŞARISIZ:', e.message, errors); process.exitCode = 1; }
finally { await browser.close(); }
