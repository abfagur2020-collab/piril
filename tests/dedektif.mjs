// Hata dedektifi testi: node tests/dedektif.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', e => errors.push(e.message));
await page.goto(url);

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fail++; };

// 1. Saf fonksiyon
const cases = [
  ['2000', 2, /1000 kat büyük.*önek/],
  ['0.002', 2, /1000 kat küçük.*önek/],
  ['0,002', 2, /1000 kat küçük.*önek/],
  ['2000000', 2, /1 milyon kat büyük/],
  ['-5', 5, /İşaret ters/],
  ['10', 5, /tam 2 kat büyük/],
  ['2,5', 5, /tam 2 kat küçük/],
  ['25', 2.5, /10 kat büyük.*bir basamak/],
  ['0,025', 2.5, /100 kat küçük.*iki basamak/],
  ['7', 5, /^$/],
  ['2,04', 2, /^$/],
  ['abc', 2, /^$/],
  ['5', 0, /^$/]
];
for (const [ans, a, re] of cases) {
  const r = await page.evaluate(([ans, a]) => clue(ans, a), [ans, a]);
  ok(re.test(r), `clue(${JSON.stringify(ans)}, ${a}) -> ${JSON.stringify(r)}`);
}

// 2. Gerçek arayüz: ders 1-1, ikinci soru num (a = 2)
await page.evaluate(() => { location.hash = 'ders-1-1'; });
await page.click('.opt');
await page.click('#ok');
await page.click('#nx');
await page.fill('#n', '2000');
await page.click('#ok');
const foot = await page.textContent('.foot');
ok(/Yanlış/.test(foot) && /1000 kat büyük/.test(foot), 'arayüzde ipucu görünüyor: ' + foot.match(/Sonucun[^.]*\./)?.[0]);
ok(!errors.length, 'konsolda hata yok' + (errors.length ? ': ' + errors.join(' | ') : ''));

await browser.close();
process.exit(fail ? 1 : 0);
