// Pırıl'dan ipucu: hiçbir ipucu cevabı ele vermez; iki adım açılır; ipucu XP'yi düşürür, ipucusuz soru tam XP verir.
// Çalıştır: node tests/ipucu.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href, shots = process.argv[2];
const browser = await chromium.launch(), errors = [];
const answer = page => page.evaluate(() => { const q = C.q; C.ans = q.t === 'mc' || q.t === 'ariza' ? q.a : q.t === 'sira' ? q.o.map((_, i) => i) : q.t === 'kur' ? q.a : String(q.a).replace('.', ','); check(); });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => localStorage.setItem('piril-hos', '1'));
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);

  // (a) Tüm sorular: ipucu cevabı içermez.
  const r = await page.evaluate(() => {
    const bad = [], count = [0, 0, 0], low = s => s.toLocaleLowerCase('tr');
    const numForms = a => [fmt(a), String(a).replace('.', ','), ...[2, 3].map(p => Number(a.toPrecision(p)).toLocaleString('tr-TR', { useGrouping: false }))];
    for (const [id, q] of Object.entries(QUESTIONS)) {
      const h = hints(q); count[h.length]++;
      if (!Array.isArray(h) || h.length > 2 || h.some(x => typeof x !== 'string' || !x)) bad.push([id, 'biçim', h]);
      for (const x of h) {
        const l = low(x), tail = x.split('=').pop();
        if ((q.t === 'num' || q.t === 'oku') && (numForms(q.a).some(f => new RegExp(`(^|[^\\d,.\\p{L}_])${f.replace(/[.]/g, '\\.')}(?![\\d,])`, 'u').test(tail)) || (!nums(q.q).includes(q.a) && nums(x).some(n => within(n, q.a))))) bad.push([id, 'sayı', x]);
        if (q.t === 'mc' && l.includes(low(q.o[q.a]))) bad.push([id, 'şık', x]);
        if (/şık/.test(l)) bad.push([id, 'şık harfi', x]);
        if (q.t === 'kur' && q.a.some(c => l.includes(c))) bad.push([id, 'bant', x]);
        if (q.t === 'oku' && q.b.slice(0, 3).some(c => l.includes(c)) && nums(x).some(n => within(n, q.a))) bad.push([id, 'bant+sayı', x]);
        if (q.t === 'ariza' && l.split(/[^\p{L}\d_]+/u).includes(low(q.a))) bad.push([id, 'arızalı', x]);
        if (q.t === 'sira' && x.includes('→')) bad.push([id, 'sıra zinciri', x]);
        if (q.t === 'sim' && /örneğin/.test(x)) bad.push([id, 'çözüm örneği', x]);
      }
    }
    return { bad, count, n: Object.keys(QUESTIONS).length };
  });
  console.log(`${r.n} soru · 0 ipucu: ${r.count[0]}, 1 ipucu: ${r.count[1]}, 2 ipucu: ${r.count[2]}`);
  assert.deepEqual(r.bad, [], 'ipucu cevabı ele vermemeli');
  assert.equal(r.count[0], 0, 'her soruda en az bir ipucu');
  assert.equal(await page.evaluate(() => [XP_HINT(3, 0), XP_HINT(3, 1), XP_HINT(3, 2), XP_HINT(1, 2), XP_HINT(2, 1)].join()), '8,4,2,1,3');

  // (b) Arayüz: zor bir sayısal soru, iki adım.
  await page.goto(url + '#ana'); await page.evaluate(() => start(['1-4-2', '1-4-4'], null, true)); await page.waitForFunction(() => C && C.q);
  assert.equal(await page.evaluate(() => C.q.t + C.q.z), 'num3');
  const ipb = page.locator('#ipb');
  assert.equal(await ipb.getAttribute('aria-expanded'), 'false');
  assert.match(await ipb.textContent(), /İpucu\s*−4 XP/);
  assert.equal(await page.locator('#ipt').getAttribute('aria-live'), 'polite');
  await ipb.focus(); await page.keyboard.press('Enter'); // klavyeyle
  assert.equal(await ipb.getAttribute('aria-expanded'), 'true');
  assert.match(await page.textContent('#ipt'), /Yöntem:/);
  assert.equal(await page.locator('#ipt p').count(), 1);
  assert.equal(await page.evaluate(() => C.hints.length), 2);
  assert.match(await ipb.textContent(), /Formül ipucu\s*−2 XP/);
  await ipb.click();
  assert.equal(await page.locator('#ipt p').count(), 2);
  assert.match(await page.textContent('#ipt'), /Formül:.*…/);
  assert.match(await ipb.textContent(), /İpucunu gizle/);
  if (shots) {
    await page.screenshot({ path: `${shots}/ipucu-light.png` });
    await page.emulateMedia({ colorScheme: 'dark' }); await page.screenshot({ path: `${shots}/ipucu-dark.png` }); await page.emulateMedia({ colorScheme: 'light' });
  }
  const { okY, vh } = await page.evaluate(() => ({ okY: $('#ok').getBoundingClientRect().bottom, vh: innerHeight }));
  assert.ok(okY <= vh, 'Kontrol et ekranda kalır');
  await ipb.click(); assert.equal(await page.locator('#ipt').isVisible(), false); assert.equal(await ipb.getAttribute('aria-expanded'), 'false');
  await ipb.click(); assert.equal(await page.locator('#ipt').isVisible(), true);
  const xp0 = await page.evaluate(() => S.xp);
  await answer(page);
  assert.equal(await page.evaluate(() => S.xp) - xp0, 2, 'iki adım: 8 → 2 XP');
  assert.match(await page.textContent('.fb h2'), /Doğru, \+2 XP/);
  assert.match(await page.textContent('.fb'), /İpucu: −6 XP/);
  assert.ok(await ipb.isDisabled(), 'cevaptan sonra ipucu kilitli');

  // İpucusuz soru tam XP.
  await page.click('#nx'); await page.waitForFunction(() => !C.checked);
  const xp1 = await page.evaluate(() => S.xp); await answer(page);
  assert.equal(await page.evaluate(() => S.xp) - xp1, 8, 'ipucusuz tam XP');
  assert.match(await page.textContent('.fb h2'), /Doğru, \+8 XP/);
  assert.doesNotMatch(await page.textContent('.fb'), /İpucu:/);

  // Tek adım: yarı XP (kolay soru 4 → 2).
  await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q && !C.checked);
  const xp2 = await page.evaluate(() => S.xp); await page.click('#ipb'); await answer(page);
  assert.equal(await page.evaluate(() => S.xp) - xp2, 2);

  // Her tür soru ekranında düğme var.
  for (const id of ['1-1-4', '1-3-5', '2-2-1', '2-2-3', '2-1-5', '1-1-1']) {
    await page.evaluate(id => start([id], null, true), id);
    assert.equal(await page.locator('#ipb').count(), 1, id);
    await page.click('#ipb'); assert.equal(await page.locator('#ipt p').count(), 1, id);
  }
  assert.deepEqual(errors, []);
  // İnceleme regresyonu: bu sorularda ipucu cevabı başka sözcüklerle söylüyordu; yalnız genel ipucu kalmalı.
  const GEN = await page.evaluate(() => ['1-2-5','1-3-2','4-1-3','6-1-1','7-1-2','7-1-5','7-2-6','8-2-1','9-1-2','9-2-5','10-3-5','11-3-6','12-3-1','1-4-3','2-1-6','8-2-2','11-1-5','7-3-4','12-1-2']
    .filter(id => QUESTIONS[id]).map(id => [id, hints(QUESTIONS[id])]).filter(([, h]) => h.length > 1 || !/ele\.|ele,|Her seçeneği|İfadeleri tek tek/.test(h[0])));
  assert.deepEqual(GEN, [], 'cevabı söyleyen ipucu kaldı: ' + JSON.stringify(GEN));
  console.log('Hepsi geçti');
} catch (e) { console.error('BAŞARISIZ:', e.message, errors); process.exitCode = 1; }
finally { await browser.close(); }
