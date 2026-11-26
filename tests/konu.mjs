// Konu anlatımı: ders pedinden önce kısa kartlar, sonra sorular. node tests/konu.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href;
const shots = process.argv[2];

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'HATA ') + m); if (!c) fail++; };

const browser = await chromium.launch();
const errs = [];
async function open(scheme) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => localStorage.setItem('piril-hos', '1')); // hoş geldin ekranı tests/hos.mjs'te
  await page.emulateMedia({ colorScheme: scheme });
  page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(url);
  return page;
}
const hash = page => page.evaluate(() => location.hash.slice(1));
const h1 = page => page.$eval('h1', e => e.textContent);
// hashchange ekranı eşzamansız çizer: adres ve beklenen öğe gelene dek bekle.
const at = (page, h, sel) => page.waitForFunction(([h, sel]) => location.hash.slice(1) === h && !!document.querySelector(sel), [h, sel], { timeout: 3000 }).then(() => true, () => false);

const page = await open('light');
const first = await page.evaluate(() => ({ name: LESSONS[0].name, q: QUESTIONS['1-1-1'].q, k: LESSONS[0].k.length }));

// Ana sayfadaki 1-1 pedine dokun: konu anlatımı açılır.
await page.click(`.node:has-text("${first.name}")`);
ok(await at(page, 'konu-1-1', '.kart'), `ped konu-1-1'e gider (${await hash(page)})`);
ok(await h1(page) === first.name, `h1 ders adı: ${await h1(page)}`);
ok(await page.evaluate(() => document.activeElement === document.querySelector('h1')), 'odak h1\'de');
ok(first.k === 3 && await page.$$eval('.kart', s => s.length) === 3, '3 kart');
ok(await page.$$eval('.kart h2', s => s.length) === 3, 'her kartta h2');
const frm = await page.$$eval('.frm code', s => s.map(e => e.textContent));
ok(['Q = n·e', 'Q = I·t'].every(f => frm.includes(f)) && frm.some(f => f.includes('mAh')), `formüller: ${frm.join(' | ')}`);
ok(await page.$$eval('.real', s => s.length === 1 && s[0].textContent.startsWith('Gerçek hayatta') && !/hayatta:/.test(s[0].textContent)), 'Gerçek hayatta kutusu');
ok(await page.$$eval('.kart .fig svg.ckt', s => s.length) === 1, 'devre çizimi');
ok(await page.$$eval('button.x', b => b.length === 1 && b[0].dataset.go === 'ana'), 'çıkış ana sayfaya');
if (shots) await page.screenshot({ path: `${shots}/konu-light.png` });

// Sorulara başla: ilk soru gelir; geri tuşu anlatıma, sonra ana sayfaya döner.
await page.click('button:has-text("Sorulara başla")');
ok(await at(page, 'ders-1-1', 'h1.q'), 'Sorulara başla ders-1-1\'e gider');
ok(await page.$eval('h1.q', e => e.textContent) === first.q, '1-1\'in ilk sorusu açık');
await page.goBack();
ok(await at(page, 'konu-1-1', '.kart') && await page.$$eval('.kart', s => s.length) === 3, 'geri: konu anlatımı');
await page.goBack();
ok(await at(page, '', '.node'), 'bir daha geri: ana sayfa');

// Çıkış X'i ana sayfaya götürür.
await page.click(`.node:has-text("${first.name}")`);
await page.click('button.x');
ok(await at(page, 'ana', '.node'), 'X ana sayfaya döner');

// Konu anlatımı olmayan ders doğrudan sorulara gider (2-1'den k silinir).
const noK = await page.evaluate(() => { const l = LESSONS.find(x => x.id === '2-1'); delete l.k; route(); return { name: l.name, q: QUESTIONS['2-1-1'].q }; });
ok(await page.$eval(`.node:has-text("${noK.name}")`, b => b.dataset.go) === 'ders-2-1', 'k olmayan ders pedi ders-2-1');
await page.click(`.node:has-text("${noK.name}")`);
await at(page, 'ders-2-1', 'h1.q');
ok(await page.$eval('h1.q', e => e.textContent) === noK.q, 'k olmayan ders doğrudan soruda');
await page.evaluate(() => { location.hash = 'ana'; });
await at(page, 'ana', '.node');
await page.evaluate(() => { location.hash = 'konu-2-1'; });
ok(await at(page, 'konu-2-1', 'h1.q'), 'k yoksa konu-2-1 de soruya gider');

// Serbest simülasyon kartı: kaydırıcılar etiketli, oynatınca ölçü değişir, tahmin/hedef yok.
await page.evaluate(() => { LESSONS[0].k.push({ h: 'Dene', p: 'Kaydırıcıları oynat.', sim: 'ohm' }); location.hash = 'konu-1-1'; });
await page.waitForFunction(() => document.querySelectorAll('.kart').length === 4);
const sl = await page.$$eval('.kart:last-child .sl', ls => ls.map(l => ({ lab: l.querySelector('span').textContent, inp: !!l.querySelector('input[type=range]:not([disabled])') })));
ok(sl.length === 2 && sl.every(s => s.lab && s.inp), `iki etiketli kaydırıcı: ${sl.map(s => s.lab).join(', ')}`);
ok(await page.$$eval('[data-p], #ok', s => s.length) === 0, 'tahmin ve kontrol düğmesi yok');
ok(await page.$$eval('.kart:last-child .fig svg', s => s.length) === 1, 'sim devresi çizili');
const rd = () => page.$eval('.kart:last-child .read', e => e.textContent);
const before = await rd();
await page.locator('.kart:last-child input[type=range]').first().fill('12');
const after = await rd();
ok(before !== after && after.includes('13,33'), `ölçü değişti: ${before} → ${after}`);
ok((await page.$eval('.kart:last-child .sl b', e => e.textContent)).startsWith('12'), 'kaydırıcı değeri yazıyor');

// Karanlık tema ekran görüntüsü.
if (shots) {
  const dark = await open('dark');
  await dark.evaluate(() => { location.hash = 'konu-1-1'; });
  await dark.waitForSelector('.kart');
  await dark.screenshot({ path: `${shots}/konu-dark.png` });
  await dark.screenshot({ path: `${shots}/konu-dark-full.png`, fullPage: true });
  await page.evaluate(() => { LESSONS[0].k.pop(); route(); });
  await page.waitForFunction(() => document.querySelectorAll('.kart').length === 3);
  await page.screenshot({ path: `${shots}/konu-light-full.png`, fullPage: true });
}

ok(!errs.length, 'konsolda hata yok' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close();
console.log(fail ? `${fail} hata` : 'Hepsi geçti');
process.exit(fail ? 1 : 0);
