// Uyarlanan zorluk: derste iki yanlış üst üste gelince Pırıl yardım önerir (isteğe bağlı "İpucu al", normal XP bedeli) ve
// sıraya aynı ünitenin önceki dersinden daha kolay ya da eşit zorlukta bir ısınma sorusu girer; derste en fazla bir kez.
// Sayım kuralı: ısınma sorusu XP'si ve tekrar kutusu normal işler, görevlerde normal bir cevap sayılır; ama ilerleme çubuğu, C.total,
// C.right, ders sonucu (done/perfect, "Hatasız bitirdin") ve "Hatasız bir ders bitir" görevi onu saymaz. Tekrar ve antrenmanda hiç girmez.
// Çalıştır: node tests/uyarlama.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href, shots = process.argv[2];
const browser = await chromium.launch(), errors = [];
const answer = (page, right) => page.evaluate(right => { const q = C.q;
  C.ans = !right ? (q.t === 'mc' ? (q.a + 1) % q.o.length : q.t === 'sira' ? q.o.map((_, i) => q.o.length - 1 - i) : q.t === 'ariza' ? '__yok__' : q.t === 'kur' ? ['siyah', 'siyah', 'siyah'] : '999999')
    : q.t === 'mc' || q.t === 'ariza' ? q.a : q.t === 'sira' ? q.o.map((_, i) => i) : q.t === 'kur' ? q.a : String(q.a).replace('.', ','); check(); }, right);
const st = page => page.evaluate(() => ({ n: C.n, total: C.total, right: C.right, q0: C.queue[0], qlen: C.queue.length, wq: C.wq, helped: !!C.helped, nudge: !!document.querySelector('.nudge'),
  kind: document.querySelector('.kind')?.textContent, out: document.querySelector('.top output')?.textContent, bar: document.querySelector('.top .bar')?.getAttribute('aria-valuenow') }));
const go = async (page, h) => { await page.evaluate(h => { location.hash = h; }, h); await page.waitForFunction(h => location.hash === '#' + h && (!h.startsWith('ders') && !h.startsWith('tekrar-coz') && !h.startsWith('pratik') || (C && C.q)), h); };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem('piril-hos', '1'));
  const newPage = async scheme => { const p = await ctx.newPage(); if (scheme) await p.emulateMedia({ colorScheme: scheme }); p.on('pageerror', e => errors.push(String(e))); p.on('console', m => m.type() === 'error' && errors.push(m.text())); await p.goto(url); return p; };
  const page = await newPage();

  // Ders seçimi: önceki dersi aynı ünitede olan, en az 5 sorulu bir ders. Önceki ders bitmiş olsun (kilit).
  const L = await page.evaluate(() => { const i = LESSONS.findIndex((l, i) => i && LESSONS[i - 1].unit === l.unit && LESSONS[i - 1].z <= l.z && l.qs.length >= 5); const l = LESSONS[i], p = LESSONS[i - 1];
    S.done[p.id] = p.qs.length; save(); return { id: l.id, prev: p.id, z: l.z, n: l.qs.length, xpz: XP_Z[l.z] }; });

  // (a) Yanlış, doğru, yanlış: üst üste değil → ısınma yok
  await go(page, 'ders-' + L.id);
  await page.evaluate(() => { window.dayQuests = () => [QUESTS[0][0], QUESTS[1][0], QUESTS[2][0]]; });
  await answer(page, false); await page.click('#nx'); await answer(page, true); await page.click('#nx'); await answer(page, false);
  assert.equal((await st(page)).wq ?? null, null, 'ardışık olmayan yanlışta ısınma yok');
  await page.click('#nx');
  assert.equal((await st(page)).nudge, false);

  // (b) Yeni ders: iki yanlış üst üste → sıradaki ısınma sorusu, Pırıl notu
  await go(page, 'ana'); await go(page, 'ders-' + L.id);
  await page.evaluate(() => { window.dayQuests = () => [QUESTS[0][0], QUESTS[1][0], QUESTS[2][0]]; });
  const qp0 = await page.evaluate(() => [...questP(S, dayNum())]);
  await answer(page, false); await page.click('#nx'); await answer(page, false);
  let s = await st(page);
  assert.ok(s.wq && s.q0 === s.wq, 'ısınma sorusu sıranın başında');
  assert.ok(s.wq.startsWith(L.prev + '-'), `önceki dersten (${s.wq})`);
  assert.equal(s.qlen, L.n - 2 + 1, 'kalan sorulara bir soru eklendi');
  assert.ok(await page.evaluate(id => QUESTIONS[id].z <= C.q.z, s.wq), 'daha kolay ya da eşit zorlukta');
  assert.equal(s.nudge, false, 'not sıradaki soruda çıkar');
  await page.click('#nx');
  s = await st(page);
  assert.ok(s.nudge, 'Pırıl notu görünür');
  assert.match(s.kind, /^Isınma sorusu · /, 'tür satırında işaret');
  assert.equal(s.out, 'Isınma');
  assert.equal(s.n, 2); assert.equal(s.total, L.n, 'C.total değişmez'); assert.equal(s.bar, '2', 'ilerleme çubuğu 2/n');
  const nudgeTxt = await page.textContent('.nudge');
  assert.match(nudgeTxt, /ısınma sorusu/); assert.match(nudgeTxt, /İpucu al/);
  assert.equal(await page.getAttribute('.nudge', 'role'), 'status');
  assert.equal(await page.evaluate(() => C.hint), 0, 'ipucu kendiliğinden açılmaz');
  const barW = await page.evaluate(() => document.querySelector('.top .bar i')?.style.width);
  if (shots) for (const scheme of ['light', 'dark']) { await page.emulateMedia({ colorScheme: scheme }); await page.waitForTimeout(250); await page.screenshot({ path: `${shots}/ses-isinma-${scheme}.png` }); }
  await page.emulateMedia({ colorScheme: 'light' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 390, 'yatay kaydırma yok');

  // (c) "İpucu al": normal ipucu, normal XP bedeli; not kapanır, odak ipucu düğmesinde
  await page.click('#nhint');
  assert.equal(await page.evaluate(() => C.hint), 1);
  assert.equal(await page.locator('.nudge').count(), 0);
  assert.equal(await page.isVisible('#ipt p'), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'ipb');
  const xp0 = await page.evaluate(() => S.xp), wantXp = await page.evaluate(() => XP_HINT(C.q.z, 1));
  await answer(page, true);
  s = await st(page);
  assert.equal(await page.evaluate(() => S.xp) - xp0, wantXp, 'ısınma sorusu normal XP verir (ipucu bedeli düşülür)');
  assert.deepEqual([s.n, s.right, s.total], [2, 0, L.n], 'ilerleme ve doğru sayısı ısınmayı saymaz');
  assert.equal(await page.evaluate(() => C.wq), null);
  assert.equal(await page.evaluate(() => questP(S, dayNum())[0] - 0), qp0[0] + 1, 'görevlerde normal doğru sayılır');
  assert.equal(await page.evaluate(() => document.querySelector('.top .bar i')?.style.width), barW, 'çubuk ilerlemedi');
  await page.click('#nx');
  s = await st(page);
  assert.equal(s.out, `3/${L.n}`, 'sayaç kaldığı yerden'); assert.doesNotMatch(s.kind, /Isınma/); assert.equal(s.nudge, false);

  // (d) Aynı derste yine iki yanlış: ikinci ısınma yok
  await answer(page, false); await page.click('#nx'); await answer(page, false);
  s = await st(page);
  assert.equal(s.wq ?? null, null, 'derste en fazla bir ısınma'); assert.equal(s.qlen, L.n - 4);
  await page.click('#nx'); assert.equal((await st(page)).nudge, false, 'not de bir kez');
  const perf0 = await page.evaluate(() => S.perfect);
  while (await page.evaluate(() => C.queue.length)) { await answer(page, true); await page.click('#nx'); }
  const r = await page.evaluate(lid => ({ done: S.done[lid], perfect: S.perfect, h1: document.querySelector('.end h1').textContent, dd: [...document.querySelectorAll('.end dd')].map(d => d.textContent), qp: questP(S, dayNum()) }), L.id);
  assert.equal(r.done, L.n - 4, 'ders sonucu yalnız asıl sorular');
  assert.equal(r.perfect, perf0); assert.equal(r.h1, 'Ders tamam');
  assert.ok(r.dd.includes(`${L.n - 4} / ${L.n}`), 'Doğru satırı asıl sorulardan');
  assert.equal(r.qp[2], 0, 'hatasız ders görevi ilerlemez');

  // (e) Isınma sorusunu da yanlış yapınca: sayılmaz, sona dönmez, tekrar kutusuna girer; ders sürer
  await go(page, 'ana'); await go(page, 'ders-' + L.id);
  await answer(page, false); await page.click('#nx'); await answer(page, false); await page.click('#nx');
  const wq = await page.evaluate(() => C.q === QUESTIONS[C.wq] && C.wq);
  assert.ok(wq);
  await answer(page, false);
  s = await st(page);
  assert.deepEqual([s.n, s.right, s.qlen], [2, 0, L.n - 2], 'yanlış ısınma sırayı ve sayacı değiştirmez');
  assert.ok(await page.evaluate(id => id in S.box, wq), 'yanlış ısınma tekrar kutusuna girer');
  await page.click('#nx'); assert.equal((await st(page)).out, `3/${L.n}`);

  // (f) Son iki soru yanlış: ders biter, ısınma eklenmez; tamamı doğruda perfect sayılır
  await go(page, 'ana'); await go(page, 'ders-' + L.id);
  for (let i = 0; i < L.n - 2; i++) { await answer(page, true); await page.click('#nx'); }
  await answer(page, false); await page.click('#nx'); await answer(page, false);
  assert.deepEqual(await page.evaluate(() => [C.queue.length, C.wq ?? null]), [0, null], 'son soruda ısınma yok');
  await page.click('#nx'); assert.equal(await page.textContent('.end h1'), 'Ders tamam');
  await go(page, 'ana'); await go(page, 'ders-' + L.id);
  const p1 = await page.evaluate(() => S.perfect);
  for (let i = 0; i < L.n; i++) { await answer(page, true); await page.click('#nx'); }
  assert.equal(await page.textContent('.end h1'), 'Hatasız bitirdin'); assert.equal(await page.evaluate(() => S.perfect), p1 + 1);

  // (g) Ünitenin ilk dersi: önceki ders yok → yalnız Pırıl notu, ısınma yok
  await go(page, 'ana'); await go(page, 'ders-1-1');
  await answer(page, false); await page.click('#nx'); await answer(page, false);
  assert.equal(await page.evaluate(() => C.wq ?? null), null);
  await page.click('#nx'); s = await st(page);
  assert.ok(s.nudge, 'not yine çıkar'); assert.equal(s.out, '3/' + s.total); assert.doesNotMatch(s.kind, /Isınma/);
  assert.doesNotMatch(await page.textContent('.nudge'), /ısınma/);

  // (h) easier(): tüm derslerde seçim kuralı
  const ez = await page.evaluate(() => { C = { queue: [] }; const bad = []; let some = 0;
    for (const l of LESSONS) for (let k = 0; k < 20; k++) { const id = easier(l.id, l.z); if (!id) continue; some++; const p = LESSONS.find(x => id.startsWith(x.id + '-'));
      if (p.unit !== l.unit || LESSONS.indexOf(p) >= LESSONS.indexOf(l) || QUESTIONS[id].z > l.z || !QUESTIONS[id]) bad.push([l.id, id]); }
    const first = LESSONS.filter((l, i) => !i || LESSONS[i - 1].unit !== l.unit).map(l => easier(l.id, l.z));
    return { bad, some, first: first.every(x => x === null) }; });
  assert.deepEqual(ez.bad, []); assert.ok(ez.some > 0); assert.ok(ez.first, 'ünite başında null');

  // (i) Tekrar ve antrenman: hiç girmez, not çıkmaz
  const p2 = await newPage();
  await p2.evaluate(() => { const t = dayNum(); Object.keys(QUESTIONS).slice(0, 6).forEach(id => S.box[id] = [0, t]); save(); });
  await go(p2, 'tekrar-coz');
  for (let i = 0; i < 4; i++) { await answer(p2, false); assert.equal(await p2.evaluate(() => C.wq ?? null), null, 'tekrarda ısınma yok'); await p2.click('#nx'); assert.equal(await p2.locator('.nudge').count(), 0); }
  await go(p2, 'pratik-2');
  for (let i = 0; i < 4; i++) { await answer(p2, false); assert.equal(await p2.evaluate(() => C.wq ?? null), null, 'antrenmanda ısınma yok'); await p2.click('#nx'); assert.equal(await p2.locator('.nudge').count(), 0); }

  assert.deepEqual(errors, []);
  console.log(`uyarlama: tamam (ders ${L.id}, ısınma ${L.prev} dersinden)`);
} finally { await browser.close(); }
