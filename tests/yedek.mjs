// Yedek indir / yükle testi: node tests/yedek.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  try { const b = await readFile(join(root, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': types[extname(p) || '.html'] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${srv.address().port}/`;

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', e => errors.push(String(e)));
let dialogs = 0;
page.on('dialog', d => { dialogs++; d.accept(); });

const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('piril-v1') || 'null'));
const setState = async s => { await page.evaluate(s => localStorage.setItem('piril-v1', JSON.stringify(s)), s); await page.goto(url + '#profil'); await page.reload(); await page.waitForSelector('#yup'); };
const upload = async (name, text) => { await page.setInputFiles('#yfile', { name, mimeType: 'application/json', buffer: Buffer.from(text) }); await page.waitForFunction(() => document.querySelector('#yst').textContent); };

try {
  await page.goto(url);
  await setState({ xp: 123, done: { '1-1': 3 }, wrong: [], streak: 2, last: 1 });
  ok(await page.evaluate(() => S.xp) === 123, 'tohum durum yüklendi (xp 123)');

  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#ydown')]);
  ok(/^akimli-yedek-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), `dosya adı: ${dl.suggestedFilename()}`);
  const backup = await readFile(await dl.path(), 'utf8');
  const b = JSON.parse(backup);
  ok(b.xp === 123 && b.done['1-1'] === 3, 'indirilen yedekte xp 123');

  await setState({ xp: 0, done: {} });
  ok((await stored()).xp === 0, 'durum sıfırlandı');
  await upload('yedek.json', backup);
  ok(dialogs === 1, 'onay soruldu');
  ok(await page.evaluate(() => S.xp) === 123 && (await stored()).xp === 123, 'yedek yüklendi: S ve localStorage xp 123');
  ok(await page.textContent('#yst') === 'Yedek yüklendi.', 'başarı notu görünüyor');
  ok(await page.textContent('dl.tbl dd') === '123', 'profil yeniden çizildi');

  for (const [name, text] of [['a.json', '{"a":1}'], ['b.json', 'not json'], ['c.json', 'null'], ['d.json', '{"xp":"9","done":{}}']]) {
    await page.evaluate(() => { document.querySelector('#yst').textContent = ''; });
    dialogs = 0;
    await upload(name, text);
    ok(dialogs === 0 && (await stored()).xp === 123 && await page.evaluate(() => S.xp) === 123, `${text}: durum değişmedi, onay sorulmadı`);
    ok(await page.$eval('#yst', e => e.classList.contains('err') && /yedeği değil/.test(e.textContent)), `${text}: hata notu görünüyor`);
  }
  // Kötü niyetli ya da bozuk alanlar: HTML, bilinmeyen ders, sonsuz sayı ayıklanır.
  await page.evaluate(() => { window.__x = 0; document.querySelector('#yst').textContent = ''; });
  await upload('kotu.json', JSON.stringify({ xp: 7, done: { '1-1': '<img src=x onerror="window.__x=1">', '1-2': 4, uydurma: 9 }, ok: { mc: 'x', num: 2 } }).replace('"xp":7', '"xp":1e999'));
  const st = await page.evaluate(() => S);
  ok(st.xp === 0 && JSON.stringify(st.done) === '{"1-2":4}' && JSON.stringify(st.ok) === '{"num":2}', `kötü alanlar ayıklandı ${JSON.stringify([st.xp, st.done, st.ok])}`);
  await page.goto(url + '#ana'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__x) === 0, 'yedekten gelen HTML çalışmadı');
  await page.goto(url + '#profil'); await page.waitForSelector('#yup');
  ok(await page.$eval('#yst', e => e.getAttribute('aria-live')) === 'polite', 'not aria-live="polite"');
  ok(errors.length === 0, `konsolda hata yok ${errors.join(' | ')}`);
} catch (e) { console.error(e); fails++; }
finally { await browser.close(); srv.close(); }
console.log(fails ? `${fails} hata` : 'hepsi geçti');
process.exit(fails ? 1 : 0);
