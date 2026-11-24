// Simülasyonda önce tahmin adımını sınar: node tests/tahmin.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href;

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'HATA ') + m); if (!c) fail++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on('console', m => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', e => errs.push(e.message));
await page.goto(url);

// (a) Her simülasyonda tahmin yönü calc'tan kesin ve tutarlı çıkıyor mu?
const dirs = await page.evaluate(() => Object.entries(SIMS).map(([k, m]) => {
  const v = Object.fromEntries(m.s.map(s => [s[0], s[5]])), s = m.s.find(s => s[0] === m.p[0]);
  const ys = Array.from({ length: 9 }, (_, i) => m.calc({ ...v, [s[0]]: s[2] + (s[3] - s[2]) * i / 8 })[m.p[1]]);
  const ds = ys.slice(1).map((y, i) => y - ys[i]);
  const seen = ds.every(d => d > 1e-9) ? 0 : ds.every(d => d < -1e-9) ? 1 : ds.every(d => Math.abs(d) <= 1e-9) ? 2 : -1;
  return { k, p: m.p.join('→'), dir: simDir(m), seen, text: simPred(m).join(' → ') + ': ' + PRED[simDir(m)] };
}));
for (const d of dirs) ok(d.seen >= 0 && d.seen === d.dir, `${d.k} (${d.p}) ${d.text}`);
ok(dirs.length === 8, `8 simülasyonun hepsinde p var (${dirs.length})`);

// (b) Arayüz: her sim sorusunda yanlış tahmin, sonra geçen değer, sonra Kontrol et.
const ids = await page.evaluate(() => Object.keys(QUESTIONS).filter(id => QUESTIONS[id].t === 'sim'));
ok(ids.length === 8, `8 sim sorusu (${ids.length})`);
for (const id of ids) {
  const info = await page.evaluate(id => {
    start([id], id.split('-').slice(0, 2).join('-'));
    const m = SIMS[QUESTIONS[id].sim], [x, y] = simPred(m), d = simDir(m);
    // Geçen bir kaydırıcı değeri bul (iki kaydırıcı, ızgara taraması).
    const [a, b] = m.s, vals = s => Array.from({ length: Math.round((s[3] - s[2]) / s[4]) + 1 }, (_, i) => +(s[2] + i * s[4]).toFixed(6));
    let pass = null;
    for (const va of vals(a)) for (const vb of vals(b)) { const r = m.calc({ [a[0]]: va, [b[0]]: vb })[m.key]; if (!pass && r >= m.min && r <= m.max) pass = { [a[0]]: va, [b[0]]: vb }; }
    return { sim: QUESTIONS[id].sim, wrong: (d + 1) % 3, pass, miss: `${x} artınca ${y} ${PRED[d].toLocaleLowerCase('tr')}.`.replace(/_/g, '') };
  }, id);
  const t = `${id} ${info.sim}:`;
  ok(await page.$$eval('.sl input', is => is.length > 0 && is.every(i => i.disabled)), `${t} kaydırıcılar kilitli`);
  ok(await page.$eval('#ok', b => b.disabled), `${t} Kontrol et kapalı`);
  ok(await page.$$eval('button[data-p]', bs => bs.length === 3), `${t} 3 tahmin düğmesi`);
  await page.click(`button[data-p="${info.wrong}"]`);
  ok(await page.$$eval('.sl input', is => is.every(i => !i.disabled)), `${t} tahminden sonra kaydırıcılar açık`);
  ok((await page.textContent('#pn')).includes('tutmadı'), `${t} "tutmadı" notu`);
  ok(await page.$eval('#pn', e => e.getAttribute('aria-live') === 'polite'), `${t} not aria-live`);
  ok(info.pass, `${t} geçen değer bulundu ${JSON.stringify(info.pass)}`);
  await page.evaluate(p => { for (const k in p) { const i = document.getElementById('s-' + k); i.value = p[k]; i.dispatchEvent(new Event('input')); } }, info.pass);
  ok(!(await page.$eval('#ok', b => b.disabled)), `${t} Kontrol et açık`);
  await page.click('#ok');
  const fb = (await page.textContent('.fb')).replace(/\s+/g, ' ');
  ok(fb.includes('Doğru'), `${t} "Doğru" geri bildirimi`);
  ok(fb.includes(info.miss), `${t} hatırlatma: "${info.miss}"`);
}

// Doğru tahminde hatırlatma çıkmaz.
await page.evaluate(id => start([id], id.split('-').slice(0, 2).join('-')), ids[0]);
await page.evaluate(() => document.querySelector(`button[data-p="${simDir(SIMS[C.q.sim])}"]`).click());
ok((await page.textContent('#pn')).includes('Doğru tahmin'), 'doğru tahmin notu');
await page.click('#ok');
ok(!(await page.textContent('.fb')).includes('artınca'), 'doğru tahminde hatırlatma yok');

ok(!errs.length, 'konsolda hata yok' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close();
console.log(fail ? `${fail} hata` : 'Hepsi geçti');
process.exit(fail ? 1 : 0);
