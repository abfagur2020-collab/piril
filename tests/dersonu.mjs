// Ders sonu: XP sayacı, günlük hedef, seri alevi yalnız günün ilk dersinde, "Sıradaki ders" doğru derse gider; sandık, çift XP saati,
// seri kilometre taşları ve seri onarma; yedek/bulut alanları doğrulanır ve birleşir.
// Çalıştır: node tests/dersonu.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href, shots = process.argv[2];
const browser = await chromium.launch(), errors = [];
const init = () => {
  localStorage.setItem('piril-hos', '1');
  const real = Date.now.bind(Date); window.__off = 0; Date.now = () => real() + window.__off; // çift XP süresi için saat kaydırılır
  // Testte soru oturumu doğrudan sürülür: cevap ver, sonraki soru ya da ders sonu.
  window.__ans = right => { const q = C.q;
    C.ans = !right ? (q.t === 'mc' ? (q.a + 1) % q.o.length : q.t === 'sira' ? q.o.map((_, i) => q.o.length - 1 - i) : q.t === 'ariza' ? '__yok' : q.t === 'kur' ? ['siyah', 'siyah', 'siyah'] : '999999')
      : q.t === 'mc' || q.t === 'ariza' ? q.a : q.t === 'sira' ? q.o.map((_, i) => i) : q.t === 'kur' ? q.a : String(q.a).replace('.', ','); check(); };
  window.__seq = (...a) => { rnd = () => a.length ? a.shift() : .99; };
  window.__go = h => { history.replaceState(null, '', '#' + h); route(); };
  window.__open = () => { S = parseState(localStorage.getItem(KEY), Object.keys(QUESTIONS)); __go(''); };
  // Dersi baştan sona oynar; son soruda ders sonu ekranı açılır. wrong: yanlış cevaplanacak soru sıraları.
  window.__play = (id, wrong = []) => { __go('ders-' + id); for (let i = 0; C.queue.length; i++) { __ans(!wrong.includes(i)); if (C.queue.length) question(); else finish(); } };
};
const ctxOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 };
async function newPage(extra = {}) {
  const ctx = await browser.newContext({ ...ctxOpts, ...extra });
  await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url); await page.waitForFunction(() => typeof S === 'object' && document.querySelector('main'));
  return page;
}
const ev = (page, f, a) => page.evaluate(f, a);
try {
  const page = await newPage();

  // (1) İlk ders: XP sayarak artar, hedef dolar, seri alevi yanar, sıradaki ders konu anlatımıyla açılır.
  await ev(page, () => __seq(.99, .99));
  const a = await ev(page, () => { __go('ders-1-1'); const l = LESSONS[0], want = l.qs.length * XP_Z[l.z] + XP_FINISH + XP_PERFECT;
    for (let i = 0; C.queue.length; i++) { __ans(true); if (C.queue.length) question(); }
    document.querySelector('#nx').click(); // gerçek düğmeyle ders sonuna
    return { want, xp: S.xp, first: document.querySelector('#xpn').textContent, sr: document.querySelector('.xpg .sr').textContent }; });
  assert.equal(a.xp, a.want, 'ilk derste beklenen XP');
  assert.equal(a.first, '0', 'sayaç 0\'dan başlar');
  assert.match(a.sr, new RegExp(`^${a.want} XP`), 'ekran okuyucu son değeri duyar');
  await page.waitForTimeout(1100);
  assert.equal(await page.textContent('#xpn'), String(a.want), 'sayaç son değerde durur');
  assert.equal(await page.getAttribute('.gl .bar', 'aria-valuenow'), String(a.want), 'hedef çubuğu bugünkü XP');
  assert.equal(await ev(page, () => document.querySelector('.gl .bar i').style.width), `${Math.min(100, Math.round(a.want / 30 * 100))}%`, 'çubuk doldu');
  assert.equal(await page.locator('.fign').count(), 1, 'günün ilk dersi: seri alevi');
  assert.match(await page.textContent('.igt'), /Seri başladı/);
  assert.equal(await page.textContent('.fign b'), '1');
  assert.equal(await page.locator('.foot').getByText('Yanlışları tekrar et').count(), 0, 'hatasızda tekrar düğmesi yok');
  assert.equal(await page.locator('.foot .btn.alt', { hasText: 'Derslere dön' }).count(), 1, 'ikincil: Derslere dön');
  assert.equal(await page.locator('#chest, #dxo, .mst, .rpok').count(), 0, 'zar tutmadı: ödül yok');
  assert.equal(await page.getAttribute('#nxl', 'data-go'), 'konu-1-2', 'sıradaki ders konu anlatımıyla');
  assert.match(await page.textContent('#nxl'), /Sıradaki ders →/);
  await page.click('#nxl'); await page.waitForFunction(() => location.hash === '#konu-1-2' && document.querySelector('.kart'));
  assert.equal(await ev(page, () => C), null, 'konu anlatımı açıldı');

  // (2) Aynı gün ikinci ders: alev yok; yanlış varsa "Yanlışları tekrar et"; konusu olmayan sıradaki ders doğrudan sorulara.
  await ev(page, () => { __seq(.99, .99); __play('1-2', [1]); });
  assert.equal(await page.locator('.fign').count(), 0, 'ikinci derste alev yok');
  assert.equal(await page.locator('.end > svg').count(), 1, 'maskot');
  assert.equal(await page.locator('[data-go="tekrar-coz"]').count(), 1, 'yanlışları tekrar et duruyor');
  assert.equal(await page.getAttribute('#nxl', 'data-go'), 'konu-1-3');
  await ev(page, () => { LESSONS.find(l => l.id === '1-4').k = undefined; __seq(.99, .99); __play('1-3'); });
  assert.equal(await page.getAttribute('#nxl', 'data-go'), 'ders-1-4', 'konusu yoksa doğrudan ders');
  await page.click('#nxl'); await page.waitForFunction(() => C && C.lid === '1-4');
  // Eski dersi yeniden oynayınca sıradaki ders ana ekrandakiyle aynı (.node.next).
  await ev(page, () => { __seq(.99, .99); __play('1-1'); });
  const nextHome = await ev(page, () => { const b = document.querySelector('#nxl').dataset.go; __go(''); return [b, document.querySelector('.node.next').dataset.go]; });
  assert.equal(nextHome[0], nextHome[1], 'sıradaki ders = ana ekrandaki sıradaki');

  // (3) Sandık: zar tutunca kapalı sandık; açınca 5–20 jeton ya da (hakkı yoksa) kaçırma hakkı. Bir kez açılır.
  await ev(page, () => { __seq(0); __play('1-1'); });
  assert.equal(await page.locator('button#chest').count(), 1, 'sandık çıktı');
  assert.equal(await page.locator('#dxo').count(), 0, 'sandıkla aynı ekranda çift XP önerisi yok');
  if (shots) { await page.waitForTimeout(3000); await page.screenshot({ path: `${shots}/dersonu-sandik.png` }); }
  let c0 = await ev(page, () => S.coins);
  await ev(page, () => __seq(.5, .5)); await page.click('#chest');
  assert.equal(await ev(page, () => S.coins), c0 + 13, '5 + floor(.5·16) = 13 jeton');
  assert.equal(await page.getAttribute('.cw', 'data-r'), '13');
  assert.match(await page.textContent('#chest'), /\+13 jeton/);
  assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('piril-v1')).coins), c0 + 13, 'kaydedildi');
  await ev(page, () => { __seq(.5, .5); chestOpen(); });
  assert.equal(await ev(page, () => S.coins), c0 + 13, 'ikinci açma yok');
  if (shots) { await page.waitForTimeout(600); await page.screenshot({ path: `${shots}/dersonu-sandik-acik.png` }); }
  // Hakkı yokken nadir sonuç: kaçırma hakkı.
  await ev(page, () => { S.freeze = false; S.refill = 5; __seq(0); __play('1-1'); __seq(.05, .5); });
  c0 = await ev(page, () => S.coins); await page.click('#chest');
  assert.deepEqual(await ev(page, () => [S.freeze, S.coins]), [true, c0], 'kaçırma hakkı verildi, jeton yok');
  assert.equal(await page.getAttribute('.cw', 'data-r'), 'freeze');
  // Hakkı varken aynı zar jeton verir.
  await ev(page, () => { __seq(0); __play('1-1'); __seq(.05, .999); });
  c0 = await ev(page, () => S.coins); await page.click('#chest');
  assert.deepEqual(await ev(page, () => [S.freeze, S.coins]), [true, c0 + 20], 'hakkı varsa jeton (en çok 20)');
  // Tekrar ve antrenman sonunda sandık yok, basit ekran.
  await ev(page, () => { __seq(0, 0); __go('pratik-1'); C.queue = ['1-1-1', '1-1-3']; C.total = 2; question(); __ans(true); question(); __ans(false); C.queue.length ? question() : finish(); });
  await ev(page, () => { while (C.queue.length) { __ans(true); if (C.queue.length) question(); else finish(); } });
  assert.match(await page.textContent('h1'), /Antrenman tamam/);
  assert.equal(await page.locator('#chest, #dxo, #nxl, .fign').count(), 0, 'antrenmanda ödül ve sıradaki ders yok');
  assert.deepEqual(await page.$$eval('.foot .btn', b => b.map(x => x.textContent)), ['Derslere dön']);

  // (4) Çift XP saati: öneri gelir, başlatınca 15 dk 2× XP; rozet soru ve ana ekranda; süre bitince normale döner; günde en çok bir öneri.
  const today = await ev(page, () => dayNum());
  await ev(page, () => { S.dxDay = -1; S.dxEnd = 0; __seq(.99, .1); __play('1-1'); });
  assert.equal(await page.locator('#dxo #dxgo').count(), 1, 'çift XP önerisi');
  assert.equal(await ev(page, () => S.dxDay), today, 'öneri günü kaydedildi');
  await page.click('#dxgo');
  const left = await ev(page, () => S.dxEnd - Date.now());
  assert.ok(left > 14.9 * 6e4 && left <= 15 * 6e4, '15 dakikalık pencere');
  assert.match(await page.textContent('#dxo'), /başladı/);
  assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('piril-v1')).dxEnd), await ev(page, () => S.dxEnd), 'kaydedildi');
  await ev(page, () => __go('ders-1-2'));
  assert.equal(await page.textContent('.top .dxb'), '2× XP · 15 dk', 'soru üst çubuğunda rozet');
  if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/dersonu-2x-soru.png` }); }
  const dbl = await ev(page, () => { const x0 = S.xp, q = C.q; __ans(true); return [S.xp - x0, XP_Z[q.z], document.querySelector('.fb h2').textContent]; });
  assert.equal(dbl[0], 2 * dbl[1], 'doğru cevap 2× XP');
  assert.match(dbl[2], new RegExp(`\\+${2 * dbl[1]} XP \\(2×\\)`), 'geri bildirimde 2×');
  const fin = await ev(page, () => { __seq(.99, 0); const l = LESSONS[1]; let x0; for (let i = 1; C.queue.length; i++) { question(); if (C.queue.length === 1) x0 = S.xp; __ans(true); } const qz = XP_Z[QUESTIONS['1-2-' + l.qs.length].z]; finish(); return { d: S.xp - x0 - 2 * qz, want: 2 * (XP_FINISH + XP_PERFECT) }; });
  assert.equal(fin.d, fin.want, 'ders bitirme XP\'si 2×');
  assert.equal(await page.locator('#dxo').count(), 0, 'pencere açıkken yeni öneri yok');
  assert.match(await page.textContent('.xpg'), /2×/);
  await ev(page, () => __go(''));
  assert.match(await page.textContent('.dxb.home'), /^2× XP · 1[45] dk$/, 'ana ekranda rozet');
  await ev(page, () => { window.__off = 10 * 6e4; }); await page.waitForTimeout(10500); // rozet her 10 sn güncellenir
  assert.match(await page.textContent('.dxb.home'), /^2× XP · [45] dk$/, 'kalan dakika güncellenir');
  await ev(page, () => { window.__off = 15 * 6e4 + 1000; __go('ders-1-2'); });
  assert.equal(await page.locator('.dxb').count(), 0, 'süre bitince rozet yok');
  const one = await ev(page, () => { const x0 = S.xp, q = C.q; __ans(true); return [S.xp - x0, XP_Z[q.z]]; });
  assert.equal(one[0], one[1], 'süre bitince normal XP');
  await ev(page, () => { __seq(.99, 0); while (C.queue.length) { question(); __ans(true); } finish(); });
  assert.equal(await page.locator('#dxo').count(), 0, 'aynı gün ikinci öneri yok');
  await ev(page, () => { S.dxDay = dayNum() - 1; __seq(.99, 0); __play('1-1'); });
  assert.equal(await page.locator('#dxo').count(), 1, 'ertesi gün yine önerilebilir');
  await ev(page, () => { S.dxDay = -1; S.dxEnd = 0; window.__off = 0; });

  // (5) Kilometre taşı: seri 7'ye ulaşınca özel kutlama + 20 jeton, bir kez.
  await ev(page, () => { S.streak = 6; S.bestStreak = Math.max(S.bestStreak, 6); S.last = dayNum() - 1; S.ms = []; S.freeze = true; });
  c0 = await ev(page, () => S.coins);
  await ev(page, () => { __seq(.99, .99); __play('1-1'); });
  assert.deepEqual(await ev(page, () => [S.streak, S.ms, S.coins]), [7, [7], c0 + 20], '7 gün: +20 jeton');
  assert.match(await page.textContent('.mst'), /7 günlük seri!/);
  assert.equal(await page.locator('.fign').count(), 1, 'seriyi uzatan ders: alev');
  assert.equal(await page.textContent('.fign b'), '7');
  await page.waitForSelector('.party.ms', { timeout: 1500 });
  assert.match(await page.textContent('.party.ms'), /7 GÜNLÜK SERİ!/);
  if (shots) { await page.waitForTimeout(500); await page.screenshot({ path: `${shots}/dersonu-kilometre.png` }); }
  await page.waitForTimeout(2600);
  await ev(page, () => { __seq(.99, .99); __play('1-1'); });
  assert.deepEqual(await ev(page, () => [S.ms, S.coins]), [[7], c0 + 20], 'ikinci kez verilmez');
  assert.equal(await page.locator('.mst').count(), 0);
  // Seri ilk kez uzarken alev ekranı (ekran görüntüsü için).
  if (shots) { await ev(page, () => { S.last = dayNum() - 1; S.streak = 8; __seq(.99, .99); __play('1-1'); }); await page.waitForTimeout(3000); await page.screenshot({ path: `${shots}/dersonu-alev.png` }); }

  // (6) Seri onarma: bozulmadan sonra ilk açılışta öneri; o gün 3 ders seriyi geri getirir; öneri tekrar etmez.
  await ev(page, () => { S.streak = 12; S.bestStreak = Math.max(S.bestStreak, 12); S.last = dayNum() - 3; S.freeze = true; S.refill = 0; S.ms = [7]; save(); });
  await ev(page, () => __open()); // uygulamayı yeniden açmak: kayıttan oku, ana ekran
  assert.deepEqual(await ev(page, () => [S.rpLost, S.rpDay, S.rpN, S.rpFor]), [12, today, 0, today - 3], 'öneri kaydedildi');
  assert.match(await page.textContent('.rp'), /Serin bozuldu \(12 gün\)\. ?Bugün 3 ders bitirirsen geri gelsin\./);
  if (shots) await page.screenshot({ path: `${shots}/dersonu-onarma.png` });
  await ev(page, () => __open());
  assert.deepEqual(await ev(page, () => [S.rpLost, S.rpN]), [12, 0], 'aynı gün yeniden açılış öneriyi bozmaz');
  await ev(page, () => { __seq(.99, .99); __play('1-1'); });
  assert.deepEqual(await ev(page, () => [S.streak, S.rpN]), [1, 1], 'ilk ders: seri 1, onarma 1/3');
  assert.match(await page.textContent('.tbl'), /Seri onarma1 \/ 3 ders/);
  await ev(page, () => { __seq(.99, .99); __play('1-2'); __seq(.99, .99); __go('pratik-1'); C.queue = ['1-1-1']; C.total = 1; question(); __ans(true); finish(); });
  assert.equal(await ev(page, () => S.rpN), 2, 'antrenman onarma sayılmaz');
  await ev(page, () => { __seq(.99, .99); __play('1-3'); });
  assert.deepEqual(await ev(page, () => [S.streak, S.rpLost, S.rpN, S.freeze, S.refill, S.bestStreak >= 13]), [13, 0, 3, false, 7, true], 'seri geri geldi: 12 + bugün');
  assert.match(await page.textContent('.rpok'), /Serin geri geldi!/);
  await page.waitForSelector('.party.ms', { timeout: 1500 });
  assert.match(await page.textContent('.party.ms'), /SERİN GERİ GELDİ!/);
  await page.waitForTimeout(2600);
  await ev(page, () => { __seq(.99, .99); __play('1-1'); });
  assert.deepEqual(await ev(page, () => [S.streak, S.rpN]), [13, 3], 'dördüncü ders seriyi yeniden şişirmez');
  assert.equal(await page.locator('.rpok').count(), 0);
  await ev(page, () => __go(''));
  assert.equal(await page.locator('.rp').count(), 0, 'onarıldı: kart yok');
  // Aynı bozulma için ikinci öneri yok; süresi geçen öneri kapanır; uzun aradan sonra ve kaçırma hakkı yetiyorsa öneri yok.
  const rp = await ev(page, () => { const t = dayNum(), r = {};
    const s1 = { ...fresh(), streak: 5, last: t - 3, rpFor: t - 3 }; r.once = [repairCheck(s1, t), s1.rpLost];
    const s2 = { ...fresh(), streak: 5, last: t - 4, rpFor: t - 4, rpLost: 5, rpDay: t - 1, rpN: 1 }; r.exp = [repairCheck(s2, t), s2.rpLost];
    const s3 = { ...fresh(), streak: 5, last: t - 9 }; r.far = [repairCheck(s3, t), s3.rpLost];
    const s4 = { ...fresh(), streak: 5, last: t - 2, freeze: true }; r.frz = [repairCheck(s4, t), s4.rpLost];
    const s5 = { ...fresh(), streak: 5, last: t - 2, freeze: false }; r.nofrz = [repairCheck(s5, t), s5.rpLost];
    const s6 = { ...fresh(), streak: 1, last: t - 3 }; r.one = [repairCheck(s6, t), s6.rpLost];
    // Öneri günü geçince 3 ders bitirmek geri getirmez.
    const s7 = { ...fresh(), streak: 1, last: t, rpLost: 9, rpDay: t - 1, rpN: 2 }; finishLesson(s7, '1-1', 6, 6, t); r.late = [s7.streak, s7.rpN];
    return r; });
  assert.deepEqual(rp, { once: [false, 0], exp: [true, 0], far: [false, 0], frz: [false, 0], nofrz: [true, 5], one: [false, 0], late: [1, 2] }, 'onarma kuralları');

  // (7) parseState: bozuk yeni alanlar atılır ya da sınırlanır.
  const ps = await ev(page, () => { const t = dayNum(), ids = Object.keys(QUESTIONS), P = o => parseState(JSON.stringify({ ...fresh(), bestStreak: 10, ...o }), ids, t), now = Date.now();
    const pick = s => [s.ms, s.dxEnd, s.dxDay, s.rpFor, s.rpDay, s.rpLost, s.rpN];
    return { t, now, ok: pick(P({ ms: [30, 7], dxEnd: now + 6e4, dxDay: t, rpFor: t - 3, rpDay: t, rpLost: 9, rpN: 2 })),
      ms: P({ ms: [7, 7, '7', 8, -1, 1e9, 30, null, 365.5] }).ms, msStr: P({ ms: 'x' }).ms,
      far: P({ dxEnd: now + 1e12 }).dxEnd, neg: P({ dxEnd: -5 }).dxEnd, str: P({ dxEnd: '9' }).dxEnd, nan: P({ dxEnd: null }).dxEnd,
      dd: [P({ dxDay: t + 3 }).dxDay, P({ dxDay: -7 }).dxDay, P({ dxDay: 1.5 }).dxDay, P({ dxDay: 'a' }).dxDay],
      rp: [P({ rpDay: t, rpLost: 1e9, rpN: 1 }), P({ rpDay: t, rpLost: -1, rpN: 1 }), P({ rpDay: t, rpLost: 5, rpN: 4 }), P({ rpDay: t + 1, rpLost: 5, rpN: 1 }), P({ rpDay: t, rpLost: '5', rpN: 1 }), P({ rpDay: t, rpLost: 2.5, rpN: 1 })].map(s => [s.rpDay, s.rpLost, s.rpN]),
      rpFor: [P({ rpFor: t + 1 }).rpFor, P({ rpFor: -3 }).rpFor, P({ rpFor: 'x' }).rpFor] }; });
  assert.deepEqual(ps.ok, [[7, 30], ps.now + 6e4, ps.t, ps.t - 3, ps.t, 9, 2], 'geçerli alanlar kalır');
  assert.deepEqual(ps.ms, [7, 30], 'kilometre taşları: yalnız bilinen, tekil');
  assert.deepEqual(ps.msStr, []);
  assert.ok(ps.far <= ps.now + 15 * 6e4 + 50 && ps.far >= ps.now + 15 * 6e4 - 50, 'uzak gelecek 15 dk\'ya sınırlanır');
  assert.deepEqual([ps.neg, ps.str, ps.nan], [0, 0, 0], 'negatif/metin/NaN çift XP sıfır');
  assert.deepEqual(ps.dd, [ps.t, -1, -1, -1], 'çift XP günü');
  assert.deepEqual(ps.rp, [[-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [ps.t, 0, 1], [-1, 0, 0]], 'bozuk onarma alanları sıfırlanır (metin rpLost: öneri yok)');
  assert.deepEqual(ps.rpFor, [-1, -1, -1]);

  // (8) mergeState: kilometre taşları birleşir, çift XP en geç, onarma iki kez yapılamaz, seri en son çalışılan cihazdan.
  const mg = await ev(page, () => { const f = o => ({ ...fresh(), ...o });
    const a = f({ xp: 100, ms: [7], dxEnd: 500, dxDay: 3, rpFor: 7, rpDay: 10, rpN: 3, rpLost: 0, last: 10, streak: 13, freeze: false, refill: 7 });
    const b = f({ xp: 200, ms: [30], dxEnd: 900, dxDay: 2, rpFor: 7, rpDay: 10, rpN: 1, rpLost: 12, last: 10, streak: 1, freeze: true, refill: 0 });
    const m = mergeState(a, b), m2 = mergeState(b, a);
    const c = f({ xp: 50, rpDay: 11, rpN: 0, rpLost: 4, rpFor: 8, last: 8, streak: 4 }), m3 = mergeState({ ...a, streak: 1 }, { ...c, freeze: false }), m3b = mergeState(a, c);
    const d = f({ xp: 300, last: 9, streak: 30, freeze: true }), m4 = mergeState(a, d);
    const e1 = f({ rpDay: 10, rpN: 1, rpLost: 12 }), e2 = f({ rpDay: 10, rpN: 2, rpLost: 12 }), m5 = mergeState(e1, e2);
    const k = x => [x.ms, x.dxEnd, x.dxDay, x.rpDay, x.rpN, x.rpLost, x.rpFor, x.last, x.streak, x.freeze, x.refill];
    return [k(m), k(m2), [m3.rpDay, m3.rpN, m3.rpLost, m3.rpFor, m3b.rpLost, m3b.streak], [m4.last, m4.streak, m4.freeze, m4.xp], [m5.rpN, m5.rpLost]]; });
  assert.deepEqual(mg[0], [[7, 30], 900, 3, 10, 3, 0, 7, 10, 13, false, 7], 'birleşim');
  assert.deepEqual(mg[1], mg[0], 'sıradan bağımsız');
  assert.deepEqual(mg[2], [11, 0, 4, 8, 0, 13], "yeni günün önerisi geçer; öteki cihazın serisi kopan günü kapsıyorsa öneri kalkar");
  assert.deepEqual(mg[3], [10, 31, false, 300], 'seri en son günden, örtüşen seriler birleşir (30 + 1 gün), XP yüksekten');

  // (8b) Seri onarılınca aynı boşlukta kopan 7 günlük söz de geri gelir ve bugün sayılır; kartlar çelişmez.
  await ev(page, () => { const t = dayNum(); Object.assign(S, { streak: 12, bestStreak: Math.max(S.bestStreak, 12), last: t - 3, freeze: false, refill: 4, rpFor: -1, rpLost: 0, rpDay: -1, rpN: 0, pledge: [t - 6, 3, t - 3, 0] }); save(); });
  await ev(page, () => __open());
  assert.deepEqual(await ev(page, () => [S.rpLost, S.pledge[3]]), [12, 2], 'onarma önerisi açık, söz o boşlukta koptu');
  assert.match(await page.textContent('.rp'), /Onarma bir kaçırma hakkı sayılır, hak 7 gün sonra dolar\./, 'onarma kartı kaçırma hakkını söyler');
  assert.match(await page.textContent('.soz .note'), /Serini bugün onarırsan söz de kaldığı yerden sürer/);
  await ev(page, () => { for (const id of ['1-1', '1-2', '1-3']) { __seq(.99, .99); __play(id); } });
  assert.deepEqual(await ev(page, () => [S.streak, S.rpLost, S.pledge.slice(1), S.pledge[2] === dayNum()]), [13, 0, [4, await ev(page, () => dayNum()), 0], true], 'söz geri geldi: 4/7, bugün sayıldı');
  await ev(page, () => __go(''));
  assert.equal(await page.textContent('.soz h2'), 'Söz: 4/7 gün');
  assert.equal(await page.locator('.rp').count(), 0, 'onarma kartı kalktı');
  const rv = await ev(page, () => { const t = dayNum(), f = o => ({ ...fresh(), ...o }), r = {};
    // Söz bu boşluktan önce kopmuşsa (son sayılan gün kopan seri gününden önce) geri gelmez; tamamlanmış ya da kapatılmış söz dokunulmaz.
    for (const [k, p] of Object.entries({ old: [t - 9, 2, t - 6, 2], kapali: [t - 6, 3, t - 3, 3], yeni: [t, 0, -1, 2] })) {
      const s = f({ streak: 1, last: t, rpFor: t - 3, rpDay: t, rpLost: 12, rpN: 2, pledge: [...p] }); finishLesson(s, '1-1', 6, 6, t); r[k] = s.pledge; }
    // Son gün: söz 6/7 iken onarma 7. günü sayar, jeton verir.
    const s = f({ streak: 1, last: t, rpFor: t - 3, rpDay: t, rpLost: 12, rpN: 2, pledge: [t - 9, 6, t - 3, 2] }), c0 = s.coins; finishLesson(s, '1-1', 6, 6, t); r.son = [...s.pledge, s.coins - c0];
    return [r, t]; });
  assert.deepEqual(rv[0], { old: [rv[1] - 9, 2, rv[1] - 6, 2], kapali: [rv[1] - 6, 3, rv[1] - 3, 3], yeni: [rv[1], 0, -1, 2], son: [rv[1] - 9, 7, rv[1], 1, 25] }, 'yalnız aynı boşlukta kopan söz geri gelir');

  // (8c) Açılmamış sandık ders sonundan çıkınca kendiliğinden açılır; ödül kısa bildirimle görünür, bir kez verilir.
  for (const via of ['ana', 'nxl']) {
    await ev(page, () => { document.querySelectorAll('.qtoast').forEach(e => e.remove()); S.freeze = true; __seq(0); __play('1-1'); });
    assert.equal(await page.locator('button#chest').count(), 1, 'sandık çıktı');
    c0 = await ev(page, () => S.coins);
    await ev(page, () => __seq(.5, .5));
    await page.click(via === 'ana' ? '.foot [data-go="ana"]' : '#nxl'); await page.waitForSelector('.qtoast.chl');
    assert.equal(await ev(page, () => S.coins), c0 + 13, `${via}: sandık ödülü verildi`);
    assert.match(await page.textContent('.qtoast.chl'), /Sandık açıldı!.*\+13/);
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('piril-v1')).coins), c0 + 13, 'kaydedildi');
    await ev(page, () => { __seq(.5, .5); __go(''); });
    assert.equal(await ev(page, () => S.coins), c0 + 13, `${via}: ikinci kez verilmez`);
  }
  // Açılmış sandıkla çıkmak ve sandıksız ders sonu bildirim göstermez.
  await ev(page, () => { document.querySelectorAll('.qtoast').forEach(e => e.remove()); __seq(0); __play('1-1'); __seq(.5, .5); });
  await page.click('#chest'); c0 = await ev(page, () => S.coins); await ev(page, () => __go(''));
  assert.deepEqual([await ev(page, () => S.coins), await page.locator('.qtoast.chl').count()], [c0, 0], 'açılmış sandık: ikinci ödül ve bildirim yok');

  // (8d) "2×" etiketi bu dersin XP'si ikiye katlandıysa görünür, o anki çift XP durumuna bakmaz.
  await ev(page, () => { S.dxEnd = 0; __seq(.99, .99); __play('1-1'); });
  assert.doesNotMatch(await page.textContent('.xpg'), /2×/);
  await ev(page, () => { S.dxEnd = Date.now() + DX_MS; finish(); }); // ders bittikten sonra açılan çift XP
  assert.doesNotMatch(await page.textContent('.xpg'), /2×/, 'sonradan açılan çift XP etiketi getirmez');
  await ev(page, () => { __seq(.99, .99); __play('1-2'); });
  assert.match(await page.textContent('.xpg'), /2×/, 'çift XP ile oynanan ders');
  await ev(page, () => { S.dxEnd = 0; finish(); });
  assert.match(await page.textContent('.xpg'), /2×/, 'süre sonra bitse de bu ders 2× kaldı');
  await ev(page, () => { S.dxEnd = 0; S.dxDay = -1; });

  // (8e) Sıradaki ders yedeği kilitli ders döndürmez.
  const nl = await ev(page, () => { const done = S.done, order = [...LESSONS], i2 = LESSONS.findIndex(l => l.id === '1-2'), i3 = LESSONS.findIndex(l => l.id === '1-3');
    S.done = Object.fromEntries(LESSONS.map(l => [l.id, 1]).filter(([id]) => id !== '1-2' && id !== '1-3'));
    [LESSONS[i2], LESSONS[i3]] = [LESSONS[i3], LESSONS[i2]]; // sıra bozulursa ilk bitmemiş ders kilitli olabilir
    const r = nextLesson(LESSONS[LESSONS.length - 1].id)?.id;
    LESSONS.splice(0, LESSONS.length, ...order); S.done = done; return r; });
  assert.equal(nl, '1-2', 'yedek: açık ders');

  // (8f) Ders sonu alevinin animasyonları ana sayfa alevininkinden ayrı; aynı adlı iki keyframes yok.
  const kf = await ev(page, () => { const names = [...document.styleSheets].flatMap(s => [...s.cssRules]).filter(r => r instanceof CSSKeyframesRule).map(r => r.name);
    return { dup: names.filter((n, i) => names.indexOf(n) !== i), has: ['ignite', 'flick', 'fin-ignite', 'fin-flick'].every(n => names.includes(n)) }; });
  assert.deepEqual(kf, { dup: [], has: true }, 'keyframes adları tekil');
  await ev(page, () => { S.last = dayNum() - 1; S.streak = 3; __seq(.99, .99); __play('1-1'); });
  assert.deepEqual(await ev(page, () => { const e = document.querySelector('.fign'); return [getComputedStyle(e).animationName, getComputedStyle(e.querySelector('svg')).animationName]; }), ['fin-ignite', 'fin-flick']);
  await ev(page, () => { S.day = -1; flameDay = -1; addXp(S, 4, dayNum()); __go(''); });
  assert.deepEqual(await ev(page, () => { const f = document.querySelector('.stat .flame.ign'), cs = getComputedStyle(f); return [cs.animationName, cs.position, Math.round(f.getBoundingClientRect().width) < 40]; }), ['ignite, flick', 'static', true], 'ana sayfa alevi kendi tutuşmasıyla, küçük');

  // (8g) "DURDURULAMAZ!" kutlama başlığı 390 px'e sığar; diğer kutlamalar da taşmaz.
  for (const [n, h] of [[6, ''], [9, ''], [0, 'SERİN GERİ GELDİ!'], [0, '365 GÜNLÜK SERİ!']]) {
    const w = await ev(page, ([n, h]) => { party(n, h || undefined, h ? 'x' : undefined); const e = document.querySelector('.party h2'); e.style.animation = 'none'; const r = e.getBoundingClientRect(); return [r.left >= 0 && r.right <= innerWidth, e.scrollWidth <= e.clientWidth + 1, e.textContent]; }, [n, h]);
    assert.deepEqual(w.slice(0, 2), [true, true], `kutlama başlığı sığar: ${w[2]}`);
  }
  await ev(page, () => document.querySelectorAll('.party').forEach(e => e.remove()));
  assert.deepEqual(mg[4], [2, 12], 'aynı gün: büyük ilerleme');

  assert.deepEqual(errors, [], 'konsol hatası yok');

  // (9) Azaltılmış hareket: sayaç ve çubuk son değerde başlar.
  const rm = await newPage({ reducedMotion: 'reduce' });
  const r = await ev(rm, () => { __seq(.99, .99); __play('1-1'); return { n: document.querySelector('#xpn').textContent, want: String(S.xp), w: document.querySelector('.gl .bar i').style.width, x: S.xp }; });
  assert.equal(r.n, r.want, 'azaltılmış harekette sayaç son değerde');
  assert.equal(r.w, `${Math.min(100, Math.round(r.x / 30 * 100))}%`);
  await rm.context().close();

  // (10) Ekran görüntüleri: açık ve koyu tema.
  if (shots) for (const scheme of ['light', 'dark']) {
    const p = await newPage({ colorScheme: scheme }), sfx = scheme === 'dark' ? '-koyu' : '';
    await ev(p, () => { S.streak = 4; S.bestStreak = 4; S.last = dayNum() - 1; __seq(0); __play('1-1'); });
    await p.waitForTimeout(3000); await p.screenshot({ path: `${shots}/dersonu-alev-sandik${sfx}.png` });
    await ev(p, () => __seq(.5, .3)); await p.click('#chest'); await p.waitForTimeout(700);
    await p.screenshot({ path: `${shots}/dersonu-sandik-acik${sfx}.png` });
    await ev(p, () => { __seq(.99, .1); __play('1-2', [2]); }); await p.waitForTimeout(3000);
    await p.screenshot({ path: `${shots}/dersonu-2x-oneri${sfx}.png` });
    await p.click('#dxgo'); await ev(p, () => __go('ders-1-3'));
    await p.waitForTimeout(400); await p.screenshot({ path: `${shots}/dersonu-2x-soru${sfx}.png` });
    await ev(p, () => { S.streak = 9; S.bestStreak = 9; S.last = dayNum() - 4; S.rpFor = -1; __go(''); scrollTo(0, 0); });
    await p.waitForTimeout(400); await p.screenshot({ path: `${shots}/dersonu-onarma${sfx}.png` });
    await p.context().close();
  }
  assert.deepEqual(errors, [], 'konsol hatası yok');
  console.log('Hepsi geçti');
} catch (e) { console.error('BAŞARISIZ:', e.message, errors); process.exitCode = 1; }
finally { await browser.close(); }
