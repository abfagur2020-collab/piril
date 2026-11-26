// Baykar Sınav ünitesi: 20 soru açılır, doğru şık seçilir, çözüm ve akım akışı görünür. Çalıştır: node tests/baykar.mjs [ekran-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href, shots = process.argv[2];
let fail = 0; const ok = (c, m) => { if (!c) { console.log('HATA ' + m); fail++; } };
const browser = await chromium.launch(), errs = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', m => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', e => errs.push(e.message));
await page.goto(url);
const u = await page.evaluate(() => { const i = UNITS.findIndex(u => u.name === 'Baykar Sınav'); return { i: i + 1, n: UNITS[i].lessons.map(l => l.qs.length), last: i === UNITS.length - 1 }; });
ok(u.i > 0 && u.last, 'Baykar ünitesi en sonda');
ok(u.n.reduce((a, b) => a + b, 0) === 20, '20 soru');
const btns = await page.$$eval(`.node[data-go^="konu-${u.i}-"]`, b => b.map(x => !x.disabled));
ok(btns.length === 4 && btns.every(Boolean), 'dört ders de açık');
let no = 0;
for (let l = 1; l <= u.n.length; l++) {
  await page.evaluate(id => location.hash = 'konu-' + id, `${u.i}-${l}`); await page.waitForSelector('.kart');
  ok(await page.locator('.kart').count() >= 5, `ders ${l}: konu kartları`);
  if (shots) await page.screenshot({ path: `${shots}/konu-${l}.png`, fullPage: true });
  await page.click('.foot .btn'); await page.waitForFunction(() => C && C.q);
  for (let k = 0; k < u.n[l - 1]; k++) {
    no++;
    const q = await page.evaluate(() => ({ a: C.q.a, c: !!C.q.c, fl: !!C.fl }));
    ok(!(await page.locator('#akb').count()), `S${no}: akış cevaptan önce gizli`);
    await page.click(`.opt[data-i="${q.a}"]`); await page.click('#ok');
    ok(/Doğru/.test(await page.textContent('.fb h2')), `S${no}: doğru şık doğru sayılır`);
    ok(await page.locator('.sol li').count() >= 4, `S${no}: çözüm adımları`);
    if (q.fl) ok(await page.locator('.fig .flow .ch').count() > 0, `S${no}: akım okları çizildi`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!wide, `S${no}: yatay taşma yok`);
    if (shots && q.c) await page.locator('.fig').screenshot({ path: `${shots}/soru-${no}.png` });
    await page.click('#nx');
  }
}
ok(!errs.length, 'konsol hatası yok: ' + errs.join(' | '));
// Yanlış cevapta da çözüm görünür
await page.evaluate(id => location.hash = 'ders-' + id, `${u.i}-1`);
await page.waitForFunction(() => C && C.q); const a = await page.evaluate(() => C.q.a); await page.click(`.opt:not([data-i="${a}"])`); await page.click('#ok');
ok(/Yanlış/.test(await page.textContent('.fb h2')) && await page.locator('.sol li').count() >= 4, 'yanlışta çözüm görünür');
await browser.close();
console.log(fail ? `${fail} hata` : `Hepsi geçti (${no} soru)`); process.exit(fail ? 1 : 0);
