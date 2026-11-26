// Günlük görevler: günün 3 görevi gün sayısından seçilir, gerçek oyunla ilerler, bitince jeton verir; gün değişince sıfırlanır; yedekteki bozuk değerler atılır.
// Çalıştır: node tests/gorev.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href, shots = process.argv[2];
const browser = await chromium.launch(), errors = [];
const answer = (page, right) => page.evaluate(right => { const q = C.q;
  C.ans = !right ? (q.t === 'mc' ? (q.a + 1) % q.o.length : q.t === 'sira' ? q.o.map((_, i) => q.o.length - 1 - i) : '999999')
    : q.t === 'mc' || q.t === 'ariza' ? q.a : q.t === 'sira' ? q.o.map((_, i) => i) : q.t === 'kur' ? q.a : String(q.a).replace('.', ','); check(); }, right);
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem('piril-hos', '1'));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);

  // (a) Belirlenimci seçim
  const sel = await page.evaluate(() => { const t = dayNum(), key = d => dayQuests(d).map(q => q[0]).join('|'), days = [...Array(60)].map((_, i) => dayQuests(t + i));
    return { same: key(t) === key(t), distinct: days.every(q => new Set(q).size === 3 && q.length === 3), fam: days.every(q => { const f = q.map(x => x[4]).filter(Boolean); return new Set(f).size === f.length; }),
      sets: new Set(days.map(q => q.map(x => x[0]).join('|'))).size, diffNext: days.slice(1).filter((q, i) => q.map(x => x[0]).join() !== days[i].map(x => x[0]).join()).length,
      home: [...document.querySelectorAll('.qst li p')].map(p => p.firstChild.textContent), want: dayQuests(t).map(q => q[0]) }; });
  assert.ok(sel.same && sel.distinct && sel.fam, 'her gün 3 ayrı görev, aynı aile tekrar etmez');
  assert.ok(sel.sets >= 15, `60 günde çeşitli görev setleri (${sel.sets})`);
  assert.ok(sel.diffNext >= 45, `ardışık günler çoğunlukla farklı (${sel.diffNext}/59)`);
  assert.deepEqual(sel.home, sel.want, 'ana ekran günün görevlerini gösterir');
  await page.reload();
  assert.deepEqual(await page.$$eval('.qst li p', ps => ps.map(p => p.firstChild.textContent)), sel.want, 'yenilemede aynı görevler');

  // (b) Gerçek oyunla ilerleme: görevler testte sabitlenir (3 doğru, 3 arka arkaya, hatasız ders)
  await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q);
  await page.evaluate(() => { window.dayQuests = () => [QUESTS[0][0], QUESTS[1][0], QUESTS[2][0]]; });
  const n = await page.evaluate(() => C.total);
  await answer(page, true); await page.click('#nx'); await answer(page, true);
  assert.deepEqual(await page.evaluate(() => S.qp), [2, 2, 0], '2 doğrudan sonra ilerleme');
  assert.equal(await page.evaluate(() => S.coins), 0);
  await page.click('#nx'); await answer(page, true);
  assert.deepEqual(await page.evaluate(() => [S.qp, S.coins]), [[3, 3, 0], 8], 'iki görev bitti, 3 + 5 jeton');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.qtoast').count(), 0, '3\'lü kutlama sürerken görev bildirimi bekler');
  await page.waitForTimeout(2500);
  assert.equal(await page.locator('.qtoast').count(), 1, 'kutlamadan sonra görev bildirimi');
  assert.match(await page.textContent('.qtoast'), /Görev tamam!.*\+8/);
  await page.waitForTimeout(500);
  if (shots) await page.screenshot({ path: `${shots}/gorev-bildirim.png` });
  assert.match(await page.textContent('#qlive'), /Görev tamam: 3 soruyu doğru çöz, 3 soruyu arka arkaya doğru yap\. \+8 jeton/, 'canlı bölge duyurur');
  for (let i = 3; i < n; i++) { await page.click('#nx'); await answer(page, true); }
  assert.deepEqual(await page.evaluate(() => [S.qp, S.coins]), [[3, 3, 1], 26], 'hatasız ders + hepsi bitti bonusu: 8 + 8 + 10');
  await page.waitForSelector('.qtoast.all', { timeout: 4000 }); // son doğru 3'lü kutlamaya denk gelirse onu bekler
  assert.match(await page.textContent('.qtoast'), /Hepsi tamam!.*\+18/);
  if (shots) { await page.waitForTimeout(500); await page.screenshot({ path: `${shots}/gorev-hepsi.png` }); }
  // Yinelenen olay jetonu yeniden vermez
  assert.equal(await page.evaluate(() => (questEv(S, { ok: true, combo: 9, fin: true, perfect: true, xp: 99 }, dayNum()), S.coins)), 26);

  // (c) Gün değişince ilerleme sıfırlanır
  const nd = await page.evaluate(() => { const t = dayNum() + 1, r = questEv(S, { ok: true, combo: 1, xp: 0 }, t); return [S.qd === t, S.qp, r.n, S.coins]; });
  assert.deepEqual(nd, [true, [1, 1, 0], 0, 26], 'yeni gün: ilerleme sıfırdan, jetonlar kalır');

  // (d) parseState bozuk jeton/ilerlemeyi atar; birleştirme
  const ps = await page.evaluate(() => { const P = o => { const s = parseState(typeof o === 'string' ? o : JSON.stringify({ xp: 5, done: {}, ...o }), Object.keys(QUESTIONS)); return [s.coins, s.qd, s.qp]; };
    const a = { ...fresh(), xp: 50, coins: 4, qd: 100, qp: [1, 0, 2] }, b = { ...fresh(), xp: 10, coins: 9, qd: 100, qp: [0, 3, 1] }, c = { ...fresh(), xp: 5, coins: 1, qd: 101, qp: [2, 2, 2] };
    const m1 = mergeState(a, b), m2 = mergeState(a, c);
    return { neg: P({ coins: -5 }), inf: P('{"xp":5,"done":{},"coins":1e999}'), frac: P({ coins: 2.5 }), str: P({ coins: '7' }), badqp: P({ qd: 3, qp: ['a'] }), shortqp: P({ qd: 3, qp: [1, 2] }),
      negqp: P({ qd: 3, qp: [1, -1, 0] }), badqd: P({ qd: 'x', qp: [1, 1, 1] }), good: P({ coins: 7, qd: 3, qp: [1, 2, 0] }), m1: [m1.coins, m1.qd, m1.qp], m2: [m2.coins, m2.qd, m2.qp] }; });
  assert.deepEqual(ps.neg[0], 0); assert.deepEqual(ps.inf[0], 0); assert.deepEqual(ps.frac[0], 0); assert.deepEqual(ps.str[0], 0);
  for (const k of ['badqp', 'shortqp', 'negqp', 'badqd']) assert.deepEqual(ps[k].slice(1), [-1, [0, 0, 0]], k);
  assert.deepEqual(ps.good, [7, 3, [1, 2, 0]], 'geçerli değerler kalır');
  assert.deepEqual(ps.m1, [9, 100, [1, 3, 2]], 'aynı gün: her görevde büyük');
  assert.deepEqual(ps.m2, [4, 101, [2, 2, 2]], 'farklı gün: yeni günün kaydı');

  // Ekran görüntüleri: ana ekran, görevler kısmen bitmiş
  if (shots) for (const scheme of ['light', 'dark']) {
    const p2 = await ctx.newPage(); await p2.emulateMedia({ colorScheme: scheme }); p2.on('pageerror', e => errors.push(String(e)));
    await p2.goto(url); await p2.evaluate(() => { const t = dayNum(), q = dayQuests(t); S.qd = t; S.qp = [q[0][1], Math.min(1, q[1][1] - 1) || 0, 0]; S.coins = 23; if (q[1][1] > 1) S.qp[1] = 1; save(); route(); scrollTo(0, 0); });
    await p2.waitForTimeout(400); await p2.screenshot({ path: `${shots}/gorev-ana-${scheme}.png` });
    const w = await p2.evaluate(() => document.documentElement.scrollWidth); assert.ok(w <= 390, 'yatay kaydırma yok'); await p2.close();
  }
  assert.deepEqual(errors, []);
  console.log('Hepsi geçti');
} catch (e) { console.error('BAŞARISIZ:', e.message, errors); process.exitCode = 1; }
finally { await browser.close(); }
