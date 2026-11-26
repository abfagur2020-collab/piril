// Akıllı tekrar: yanlış soru kutuya girer, doğrular 1, 3, 7 gün sonraya atar, 4. doğruda çıkar; eski wrong kaydı taşınır.
// Çalıştır: node tests/tekrar.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
// file:// adresinde localStorage yeniden yüklemede güvenilir kalmıyor; küçük bir sunucu açılır.
const srv = createServer(async (req, res) => { if (new URL(req.url, 'http://x').pathname !== '/') { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(await readFile(new URL('../index.html', import.meta.url))); }).listen(0);
const url = `http://localhost:${srv.address().port}/`, shots = process.argv[2];
const browser = await chromium.launch(), errors = [];
const answer = (page, right) => page.evaluate(right => { const q = C.q;
  C.ans = !right ? (q.t === 'mc' ? (q.a + 1) % q.o.length : q.t === 'sira' ? q.o.map((_, i) => q.o.length - 1 - i) : '999999')
    : q.t === 'mc' || q.t === 'ariza' ? q.a : q.t === 'sira' ? q.o.map((_, i) => i) : String(q.a).replace('.', ','); check(); }, right);
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(String(e)));
  // Saat ileri alınabilsin: localStorage'daki gün kayması kadar Date ileri gider.
  await page.addInitScript(() => {
    localStorage.setItem('piril-hos', '1');
    const D = Date, off = () => +(localStorage.getItem('test-gun') || 0) * 864e5;
    window.Date = class extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off()])); } static now() { return D.now() + off(); } };
  });
  await page.goto(url); await page.waitForFunction(() => typeof record === 'function');

  // (a) saf mantık
  const a = await page.evaluate(() => {
    const s = fresh(), id = '1-1-1', out = [], snap = () => out.push(JSON.stringify([s.box[id] || null, s.fixed]));
    record(s, id, 'mc', false, 100); snap();             // yanlış: 0, bugün
    record(s, id, 'mc', true, 100); snap();              // 1, +1
    record(s, id, 'mc', true, 100); snap();              // vadesi gelmedi: değişmez
    out.push(dueIds(s, 100).length, dueIds(s, 101).length);
    record(s, id, 'mc', true, 101); snap();              // 2, +3
    record(s, id, 'mc', true, 104); snap();              // 3, +7
    record(s, id, 'mc', true, 111); snap();              // çıktı, fixed 1
    record(s, id, 'mc', false, 120); record(s, id, 'mc', true, 120); record(s, id, 'mc', true, 121); snap(); // 2. seviye
    record(s, id, 'mc', false, 122); snap();             // başa döner
    return out;
  });
  assert.deepEqual(a, ['[[0,100],0]', '[[1,101],0]', '[[1,101],0]', 0, 1, '[[2,104],0]', '[[3,111],0]', '[null,1]', '[[2,124],1]', '[[0,122],1]'], 'kutu mantığı');

  // (b) taşıma ve doğrulama
  const b = await page.evaluate(() => {
    const ids = Object.keys(QUESTIONS), t = dayNum();
    const m = parseState(JSON.stringify({ xp: 5, wrong: ['1-1-1', '1-1-2', 'yok-1'] }), ids);
    const g = parseState(JSON.stringify({ box: { 'x-y-z': [0, 1], '1-1-1': [1, 5.5], '1-1-2': [9, 1], '1-1-3': [-1, 1], '1-1-4': [2, 'a'], '1-2-1': 'x', '1-2-2': [3, 7, 99], '__proto__': [0, 1] } }), ids);
    const arr = parseState(JSON.stringify({ box: [[0, 1]] }), ids);
    const mg = mergeState({ ...fresh(), xp: 10, box: { '1-1-1': [2, 50], '1-1-2': [1, 60] } }, { ...fresh(), xp: 5, box: { '1-1-1': [0, 40], '1-1-2': [1, 55], '1-1-3': [3, 70] } });
    return { m: m.box, t, mw: 'wrong' in m, g: g.box, arr: arr.box, mg: mg.box };
  });
  assert.deepEqual(b.m, { '1-1-1': [0, b.t], '1-1-2': [0, b.t] }, 'eski wrong bugün vadeli kutuya taşınır');
  assert.equal(b.mw, false, 'wrong alanı kalmaz');
  assert.deepEqual(b.g, { '1-2-2': [3, 7] }, 'bozuk kutu girdileri atılır');
  assert.deepEqual(b.arr, {}, 'dizi kutu atılır');
  assert.deepEqual(b.mg, { '1-1-1': [0, 40], '1-1-2': [1, 55], '1-1-3': [3, 70] }, 'bulut birleşmesi zayıf olanı tutar');

  // (c) arayüz: derste bir yanlış
  await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q);
  await answer(page, false);
  while (await page.evaluate(() => C.queue.length)) { await page.click('#nx'); await answer(page, true); }
  await page.click('#nx');
  await page.click('[data-go="tekrar-coz"]'); await page.waitForFunction(() => C && C.q && !C.lid);
  assert.equal(await page.evaluate(() => C.total), 1, 'Yanlışları tekrar et: o dersin yanlışı');
  const onReview = () => page.waitForFunction(() => !C && document.querySelector('h1')?.textContent === 'Tekrar');
  await page.goto(url + '#tekrar'); await onReview();
  assert.match(await page.textContent('main'), /Bugün tekrar: 1/);
  assert.equal(await page.textContent('nav b'), '1', 'gezinme rozeti 1');
  await page.click('main [data-go="tekrar-coz"]'); await page.waitForFunction(() => C && C.q && C.total === 1);
  await answer(page, true); await page.click('#nx');
  await page.goto(url + '#tekrar'); await onReview(); await page.reload(); await onReview();
  const txt = await page.textContent('main');
  assert.match(txt, /Bugün tekrar yok/); assert.match(await page.textContent('#bekle'), /yarın 1/);
  assert.equal(await page.locator('nav b').count(), 0, 'rozet yok');
  // biraz daha: ekran görüntüsü için 3 gün sonraya bekleyen bir soru ve bugün vadeli iki soru
  await page.evaluate(() => localStorage.setItem('test-gun', '1')); await page.reload(); await onReview();
  assert.match(await page.textContent('main'), /Bugün tekrar: 1/, 'bir gün sonra yine gelir');
  assert.equal(await page.textContent('nav b'), '1');
  if (shots) {
    for (const m of ['light', 'dark']) {
      const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: m, serviceWorkers: 'block' });
      await p.addInitScript(() => localStorage.setItem('piril-hos', '1'));
      await p.goto(url); await p.waitForFunction(() => typeof record === 'function');
      await p.evaluate(() => { const t = dayNum(); S.box = { '1-1-1': [0, t], '1-2-1': [0, t], '1-2-2': [1, t + 1], '1-2-3': [1, t + 1], '2-1-1': [2, t + 3] }; save(); });
      await p.goto(url + '#tekrar'); await p.reload(); await p.waitForSelector('#bekle');
      await p.evaluate(() => document.querySelector('main h2:nth-of-type(2)').scrollIntoView());
      await p.waitForTimeout(800); await p.screenshot({ path: `${shots}/tekrar-${m}.png` }); await p.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log('Hepsi geçti');
} catch (e) { console.error('BAŞARISIZ:', e.message, errors); process.exitCode = 1; }
finally { await browser.close(); srv.close(); }
