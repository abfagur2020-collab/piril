// Günlük hedef seçimi, 7 günlük söz ve seri alevi: yeni kullanıcıya Pırıl hedefi ve sözü sorar (hesaptan önce), Profil'den hedef değişir,
// bozuk hedef ve söz kayıtları atılır, söz günleri sayılır (7'de bir kez kutlama + jeton), seri koparsa söz nazikçe biter,
// hatırlatıcılar kişisel hedefi kullanır, alev bugün XP yokken sönük, varken yanar ve günün ilk dersinden sonra bir kez tutuşur.
// Çalıştır: node tests/hedef.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { run, trNow } from '../.github/hatirlat/gonder.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url)), shots = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { const p = new URL(q.url, 'http://x').pathname, f = path.join(root, decodeURIComponent(p === '/' ? '/index.html' : p));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const swSrc = /function reminderText[\s\S]*?\n}\n/.exec(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'))[0];
const reminderText = new Function(swSrc + 'return reminderText;')();
const browser = await chromium.launch(), errors = [];
const DAY = 864e5, base = new Date(2026, 10, 2, 12).getTime(); // yerel öğlen: gün sınırına uzak
const answer = (page, right) => page.evaluate(right => { const q = C.q;
  C.ans = !right ? (q.t === 'mc' ? (q.a + 1) % q.o.length : q.t === 'sira' ? q.o.map((_, i) => q.o.length - 1 - i) : '999999')
    : q.t === 'mc' || q.t === 'ariza' ? q.a : q.t === 'sira' ? q.o.map((_, i) => i) : q.t === 'kur' ? q.a : String(q.a).replace('.', ','); check(); }, right);
async function newCtx(dark, hos) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light' });
  if (hos) await ctx.addInitScript(() => localStorage.setItem('piril-hos', '1'));
  // Google ve Firebase bu ortamda yok: sahte GIS, Firebase isteği kesilir (ağ hatası konsol hatası sayılmaz)
  await ctx.route('https://accounts.google.com/gsi/client', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.google = { accounts: { id: { initialize() {}, renderButton(el) { const b = document.createElement("button"); b.id = "gmock"; b.textContent = "Google"; el.append(b); } } } };' }));
  await ctx.route('https://www.gstatic.com/**', r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => m.type() === 'error' && !/Failed to load resource|ERR_FAILED|firebase/i.test(m.text()) && errors.push(m.text()));
  return [ctx, page];
}
const shot = async (page, name, anim) => shots && (await page.evaluate(() => scrollTo(0, 0)), await page.screenshot({ path: path.join(shots, `hedef-${name}.png`), animations: anim ? 'allow' : 'disabled' }));
const home = page => page.evaluate(() => { history.replaceState(null, '', location.pathname); route(); });
const card = page => page.evaluate(() => document.querySelector('.soz h2')?.textContent ?? null);
const flame = page => page.evaluate(() => { const f = document.querySelector('.stat .flame'); return { on: f.classList.contains('on'), ign: f.classList.contains('ign'), sr: document.querySelector('.stat .sk .sr').textContent }; });

try {
  for (const dark of [false, true]) {
    const tag = dark ? 'koyu' : 'acik', [ctx, page] = await newCtx(dark, false);
    await page.clock.setFixedTime(base);
    // 1. Yeni kullanıcı: Ben yeniyim → hedef → söz → hesap
    await page.goto(url); await page.waitForSelector('.hos');
    await page.click('[data-h="3"]');
    assert.match(await page.textContent('h1'), /Günde ne kadar zaman ayırmak istersin/);
    assert.deepEqual(await page.$$eval('.gopt', b => b.map(x => x.textContent)), ['3 dkRahat · günde 20 XP', '5 dkNormal · günde 30 XP', '10 dkCiddi · günde 60 XP']);
    assert.equal(await page.locator('#hskip, #gbtn').count(), 0, 'hesap adımı henüz yok');
    await page.waitForTimeout(1000); await shot(page, `hosgeldin-hedef-${tag}`);
    await page.click('[data-g="60"]');
    assert.equal(await page.evaluate(() => S.goal), 60);
    assert.match(await page.textContent('h1'), /7 gün boyunca her gün biraz çalışmaya söz veriyor musun/);
    assert.equal(await page.locator('.hos .dots li').count(), 7);
    assert.deepEqual(await page.$$eval('.hos .acts button', b => b.map(x => x.textContent)), ['Söz veriyorum', 'Şimdilik değil']);
    await page.waitForTimeout(1000); await shot(page, `hosgeldin-soz-${tag}`);
    await page.click('#hsoz');
    const t0 = await page.evaluate(() => dayNum());
    assert.deepEqual(await page.evaluate(() => S.pledge), [t0, 0, -1, 0]);
    assert.match(await page.textContent('h1'), /kaydol/i, 'söz sonrası hesap adımı');
    await page.click('#hskip'); await page.waitForSelector('.pcb');
    assert.equal(await page.evaluate(() => localStorage.getItem('piril-hos')), '1');
    // Ana sayfa: hedef çubuğu 60, alev sönük, söz takibi 0/7
    assert.equal(await page.getAttribute('.goal .bar', 'aria-valuemax'), '60');
    assert.match(await page.textContent('.goal'), /Bugün 0 \/ 60 XP/);
    assert.deepEqual(await flame(page), { on: false, ign: false, sr: '. Bugün seri yanmadı' });
    assert.equal(await card(page), 'Söz: 0/7 gün');
    assert.equal(await page.locator('.soz .dots li.now').count(), 1);
    await shot(page, `ana-sonuk-${tag}`);
    // Günün ilk dersi: alev bir kez tutuşur, söz 1/7
    await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q);
    while (!(await page.locator('main .end').count())) { await answer(page, true); await page.click('#nx'); } // dersi bitir, bitiş ekranından dön
    await page.click('.foot [data-go="ana"]'); await page.waitForSelector('.pcb');
    assert.deepEqual(await flame(page), { on: true, ign: true, sr: '. Seri yanıyor' });
    assert.equal(await card(page), 'Söz: 1/7 gün');
    assert.match(await page.textContent('.soz .note'), /Bugün tamam/);
    assert.equal(await page.locator('.soz .dots li.on').count(), 1);
    assert.match(await page.textContent('.goal'), /Bugün \d+ \/ 60 XP/);
    await page.waitForTimeout(1000); await shot(page, `ana-yanik-${tag}`);
    await home(page);
    assert.deepEqual(await flame(page), { on: true, ign: false, sr: '. Seri yanıyor' }, 'tutuşma günde bir kez');
    await page.reload(); await page.waitForSelector('.pcb');
    assert.equal((await flame(page)).ign, false, 'yenilemede tutuşma yok');
    // Hatırlatıcı özeti kişisel hedefi taşır; sw.js aynı özetle karar verir
    const d = await page.evaluate(async () => { shareState(); await new Promise(r => setTimeout(r, 200)); return (await (await caches.open('akimli-durum')).match('durum')).json(); });
    assert.equal(d.goal, 60);
    assert.match(reminderText({ ...d, rem: 1, streak: 1, dayXp: 40, day: t0 }, t0, 12, null, 0), /Hedefe 20 XP kaldı/);
    assert.equal(reminderText({ ...d, rem: 1, goal: 20, dayXp: 25, day: t0 }, t0, 12, null, 0), null);
    // Ertesi gün: alev sönük, yeni gün ilk XP'de yine tutuşur
    await page.clock.setFixedTime(base + DAY); await page.reload(); await page.waitForSelector('.pcb');
    assert.equal((await flame(page)).on, false);
    await page.evaluate(() => { addXp(S, 4, dayNum()); save(); }); await home(page);
    assert.deepEqual(await flame(page), { on: true, ign: true, sr: '. Seri yanıyor' });
    assert.equal(await card(page), 'Söz: 2/7 gün');
    await ctx.close();
  }

  // 2. "Şimdilik değil": söz yok, varsayılan hedef seçilebilir; Profil'den hedef değişir
  {
    const [ctx, page] = await newCtx(false, false);
    await page.goto(url); await page.click('[data-h="3"]'); await page.click('[data-g="30"]'); await page.click('[data-h="1"]');
    assert.match(await page.textContent('h1'), /kaydol/i);
    await page.click('#hskip'); await page.waitForSelector('.pcb');
    assert.deepEqual(await page.evaluate(() => [S.goal, S.pledge]), [30, []]);
    assert.equal(await page.locator('.soz').count(), 0, 'söz verilmediyse takip yok');
    await page.goto(url + '#profil'); await page.waitForSelector('#hedef');
    assert.equal(await page.inputValue('#hedef'), '30');
    assert.deepEqual(await page.$$eval('#hedef option', o => o.map(x => x.textContent)), ['3 dk · Rahat (20 XP)', '5 dk · Normal (30 XP)', '10 dk · Ciddi (60 XP)']);
    await page.selectOption('#hedef', '20');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('piril-v1')).goal), 20);
    assert.match(await page.textContent('.tbl'), /Bugün0 \/ 20 XP/);
    await page.reload(); await page.waitForSelector('#hedef');
    assert.equal(await page.inputValue('#hedef'), '20');
    await home(page);
    assert.equal(await page.getAttribute('.goal .bar', 'aria-valuemax'), '20');
    // Günün akımı rozeti kişisel hedefle sayılır
    assert.deepEqual(await page.evaluate(() => { const s = fresh(); s.goal = 20; addXp(s, 18, 100); const a = s.goalDays; addXp(s, 4, 100); const b = s.goalDays; addXp(s, 40, 100);
      const u = fresh(); u.goal = 60; addXp(u, 30, 100); const c = u.goalDays; addXp(u, 30, 100); return [a, b, s.goalDays, c, u.goalDays]; }), [0, 1, 1, 0, 1]);
    // Hedef gün içinde değişirse gün bir kez sayılır: yükseltip yeniden geçmek ikinci kez saymaz, ertesi gün yine sayılır
    assert.deepEqual(await page.evaluate(() => { const s = fresh(); s.goal = 20; addXp(s, 25, 100); s.goal = 60; goalTick(s, 100); addXp(s, 40, 100); const a = s.goalDays; addXp(s, 70, 101); return [a, s.goalDays, s.goalDay]; }), [1, 2, 101]);
    // Gerçek akış: 25 XP'deyken hedef 60'tan 20'ye düşürülünce bugün hemen sayılır; geri 60'a çıkıp geçince yine bir kez
    await page.evaluate(() => { const t = dayNum(); Object.assign(S, { day: t, dayXp: 25, goal: 60, goalDays: 0, goalDay: -1 }); save(); });
    await page.goto(url + '#profil'); await page.waitForSelector('#hedef');
    await page.selectOption('#hedef', '20');
    assert.deepEqual(await page.evaluate(() => [S.goalDays, S.goalDay === dayNum(), JSON.parse(localStorage.getItem('piril-v1')).goalDays]), [1, true, 1], 'düşürülen hedef bugünü sayar');
    await page.selectOption('#hedef', '60'); await page.evaluate(() => { addXp(S, 40, dayNum()); save(); });
    await page.selectOption('#hedef', '20');
    assert.equal(await page.evaluate(() => S.goalDays), 1, 'aynı gün ikinci kez sayılmaz');
    // parseState: goalDay doğrulanır; eski kayıtta yoksa ve bugün hedef geçilmişse sayılmış kabul edilir; birleşmede en büyük
    assert.deepEqual(await page.evaluate(() => { const t = dayNum(), ids = Object.keys(QUESTIONS), P = o => parseState(JSON.stringify({ goal: 30, ...o }), ids).goalDay;
      const legacy = parseState(JSON.stringify({ goal: 30, day: t, dayXp: 35, goalDays: 4 }), ids); addXp(legacy, 5, t);
      return [P({ goalDay: t - 2 }) === t - 2, P({ goalDay: t + 1 }), P({ goalDay: 1.5 }), P({ day: t, dayXp: 35 }) === t, P({ day: t, dayXp: 10 }), P({ goalDay: 'x', day: t, dayXp: 40 }) === t, legacy.goalDays,
        mergeState({ ...fresh(), xp: 9, goalDays: 3, goalDay: 5 }, { ...fresh(), xp: 1, goalDays: 7, goalDay: 8 }).goalDays, mergeState({ ...fresh(), xp: 9, goalDay: 5 }, { ...fresh(), xp: 1, goalDay: 8 }).goalDay]; }),
      [true, -1, -1, true, -1, true, 4, 7, 8]);
    await ctx.close();
  }

  // 3. Eski kullanıcı (hoş geldin görülmüş): yeni adımlar yok, eski kayıt varsayılan hedefle açılır
  {
    const [ctx, page] = await newCtx(false, true);
    await page.addInitScript(() => localStorage.getItem('piril-v1') || localStorage.setItem('piril-v1', JSON.stringify({ xp: 120, done: { '1-1': 4 }, last: -1, streak: 0 })));
    await page.goto(url); await page.waitForSelector('.pcb');
    assert.equal(await page.locator('.hos').count(), 0);
    assert.deepEqual(await page.evaluate(() => [S.goal, S.pledge, S.xp]), [30, [], 120]);
    assert.match(await page.textContent('.goal'), /Bugün 0 \/ 30 XP/);
    assert.equal(await page.locator('.soz').count(), 0);
    // parseState: güvenilmeyen hedef ve söz değerleri atılır
    const ps = await page.evaluate(() => { const ids = Object.keys(QUESTIONS), P = o => { const s = parseState(JSON.stringify(o), ids); return [s.goal, s.pledge]; };
      return { ok: P({ goal: 60, pledge: [100, 3, 102, 0] }), g20: P({ goal: 20 }).at(0), g45: P({ goal: 45 }).at(0), gs: P({ goal: '60' }).at(0), gf: P({ goal: 20.5 }).at(0), gn: P({ goal: null }).at(0),
        bad: [[1, 2, 3], [1, 8, 3, 0], [1.5, 0, -1, 0], [1, 2, 3, 4], [-1, 0, -1, 0], [1, 0, -2, 0], [1, -1, -1, 0], ['1', 0, -1, 0], [1, 0, -1, 0, 0], [1, 0, -1, null]].map(p => P({ pledge: p })[1]),
        str: P({ pledge: 'x' })[1], obj: P({ pledge: { 0: 1 } })[1], nul: P({ pledge: null })[1], fresh: P({})[1] }; });
    assert.deepEqual(ps.ok, [60, [100, 3, 102, 0]]);
    assert.equal(ps.g20, 20);
    for (const g of [ps.g45, ps.gs, ps.gf, ps.gn]) assert.equal(g, 30, 'geçersiz hedef varsayılana döner');
    for (const p of [...ps.bad, ps.str, ps.obj, ps.nul, ps.fresh]) assert.deepEqual(p, []);
    // mergeState: daha yeni söz, aynı sözde daha ileri olan kalır
    const mg = await page.evaluate(() => { const A = o => Object.assign(fresh(), o);
      return [mergeState(A({ xp: 9, pledge: [100, 2, 101, 0] }), A({ xp: 1, pledge: [105, 1, 105, 0] })).pledge, mergeState(A({ xp: 9, pledge: [100, 2, 101, 0] }), A({ xp: 1, pledge: [100, 4, 103, 0] })).pledge,
        mergeState(A({ xp: 1, pledge: [] }), A({ xp: 9, pledge: [100, 2, 101, 2] })).pledge, mergeState(A({ xp: 9, pledge: [100, 2, 101, 0] }), A({ xp: 1 })).pledge, mergeState(A({ xp: 9, goal: 60 }), A({ xp: 1, goal: 20 })).goal]; });
    assert.deepEqual(mg, [[105, 1, 105, 0], [100, 4, 103, 0], [100, 2, 101, 2], [100, 2, 101, 0], 60]);
    await ctx.close();
  }

  // 4. Söz 7 gün: saat kontrollü; kaçırma hakkıyla atlanan gün sözü bozmaz; 7'de bir kez kutlama + 25 jeton
  {
    const [ctx, page] = await newCtx(false, true);
    await page.clock.setFixedTime(base); await page.goto(url); await page.waitForSelector('.pcb');
    await page.evaluate(() => pledgeNew()); await home(page);
    assert.equal(await card(page), 'Söz: 0/7 gün');
    const days = [0, 1, 2, 4, 5, 6, 7]; // 3. gün kaçırıldı, kaçırma hakkı kullanılır
    for (const [i, d] of days.entries()) {
      await page.clock.setFixedTime(base + d * DAY);
      if (i === 0) { await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q); await answer(page, true); }
      else await page.evaluate(() => { window.__c = S.coins; addXp(S, 4, dayNum()); save(); });
      await page.evaluate(i => { history.replaceState(null, '', location.pathname); if (i < 6) route(); route(); }, i); // iki kez çizim: sayım günde bir
      if (i < 6) { assert.equal(await card(page), `Söz: ${i + 1}/7 gün`, `gün ${d}`); assert.equal(await page.locator('.party').count(), 0); }
    }
    await page.waitForSelector('.party');
    assert.equal(await page.textContent('.party h2'), 'Sözünü tuttun!');
    assert.match(await page.textContent('.party p'), /7 gün · \+25 jeton/);
    assert.deepEqual(await page.evaluate(() => [S.coins - window.__c, S.pledge[1], S.pledge[3], S.freeze]), [25, 7, 3, false]);
    const coins = await page.evaluate(() => S.coins);
    assert.equal(await card(page), 'Söz: 7/7 gün', 'kutlama sırasında dolu takip');
    await page.waitForTimeout(1200); await shot(page, 'soz-tuttun-acik', true);
    await page.waitForSelector('.party', { state: 'detached', timeout: 5000 });
    await page.reload(); await page.waitForSelector('.pcb'); await page.waitForTimeout(600);
    assert.equal(await page.locator('.party').count(), 0, 'kutlama bir kez');
    assert.equal(await page.locator('.soz').count(), 0, 'tutulan söz kartı kalkar');
    await page.evaluate(() => { addXp(S, 4, dayNum()); save(); });
    assert.equal(await page.evaluate(() => S.coins), coins, 'jeton bir kez');

    // 5. Seri koparsa söz nazikçe biter; "Yeniden söz ver" bugünden sayar; "Kapat" gizler
    await page.evaluate(() => { S.freeze = false; pledgeNew(); addXp(S, 4, dayNum()); save(); }); await home(page);
    assert.equal(await card(page), 'Söz: 1/7 gün');
    await page.clock.setFixedTime(base + 10 * DAY); await page.reload(); await page.waitForSelector('.pcb');
    assert.equal(await card(page), 'Söz bitti, istersen yeniden başla');
    assert.equal(await page.evaluate(() => S.pledge[3]), 2);
    assert.equal(await page.textContent('#sozyeni'), 'Yeniden söz ver');
    assert.doesNotMatch(await page.textContent('.soz'), /kaybettin|başaramadın|maalesef/i);
    await shot(page, 'soz-bitti-acik');
    await page.click('#sozyeni');
    assert.equal(await card(page), 'Söz: 0/7 gün');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sozh');
    assert.deepEqual(await page.evaluate(() => S.pledge), [await page.evaluate(() => dayNum()), 0, -1, 0]);
    // Söz verilip iki gün ders yapılmazsa da biter; ertesi gün ders yapmak yeter
    await page.clock.setFixedTime(base + 11 * DAY); await page.reload(); await page.waitForSelector('.pcb');
    assert.equal(await card(page), 'Söz: 0/7 gün', 'ertesi gün hâlâ sürer');
    await page.clock.setFixedTime(base + 12 * DAY); await page.reload(); await page.waitForSelector('.pcb');
    assert.equal(await card(page), 'Söz başlamadı, istersen bugün başla.', 'hiç gün tutulmadıysa "söz bitti" denmez');
    assert.equal(await page.textContent('.soz .note'), 'Yeni söz bugünden sayılır.');
    // Bugün ders yaptıktan sonra yeniden söz: bugün sayılır
    await page.evaluate(() => { addXp(S, 4, dayNum()); save(); }); await page.click('#sozyeni');
    assert.equal(await card(page), 'Söz: 1/7 gün');
    // Kapat
    await page.evaluate(() => { S.pledge = [dayNum() - 5, 1, dayNum() - 5, 0]; save(); }); await home(page);
    assert.equal(await card(page), 'Söz bitti, istersen yeniden başla');
    await page.click('#sozkapat');
    assert.equal(await page.locator('.soz').count(), 0);
    assert.equal(await page.evaluate(() => S.pledge[3]), 3);
    await ctx.close();
  }

  // 6. Azaltılmış hareket: alev yanık ama titremez, tutuşmaz
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => localStorage.setItem('piril-hos', '1'));
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url); await page.waitForSelector('.pcb');
    await page.evaluate(() => { addXp(S, 4, dayNum()); save(); }); await home(page);
    assert.deepEqual(await page.evaluate(() => { const f = document.querySelector('.flame'); return [f.classList.contains('on'), getComputedStyle(f).animationName, getComputedStyle(f.querySelector('.fo')).fill]; }), [true, 'none', 'rgb(228, 87, 46)']);
    await ctx.close();
  }

  // 7. Sunucu hatırlatması (gonder.mjs) kayıttaki hedefi kullanır
  {
    const now = new Date('2026-11-26T16:47:00Z'), { today } = trNow(now), sub = JSON.stringify({ endpoint: 'https://push.example/1', keys: { p256dh: 'a', auth: 'b' } }), sent = [];
    const s = o => JSON.stringify({ rem: 1, day: today, dayXp: 40, last: today, streak: 1, freeze: true, box: {}, ...o });
    const out = await run({ docs: [{ id: 'a', s: s({ goal: 60 }), p: sub }, { id: 'b', s: s({}), p: sub }, { id: 'c', s: s({ goal: 999 }), p: sub }, { id: 'd', s: s({ goal: 20, dayXp: 12 }), p: sub }],
      now, rnd: () => 0, send: async (x, pl) => sent.push(JSON.parse(pl).body), update: async () => {} });
    assert.deepEqual(sent, ['Hedefe 20 XP kaldı. Kısa bir ders yeter.', 'Hedefe 8 XP kaldı. Kısa bir ders yeter.']);
    assert.deepEqual(out, { sent: 2, skip: 2, gone: 0, fail: 0 });
  }
  assert.deepEqual(errors, []);
  console.log('Hepsi geçti');
} catch (e) { console.error('BAŞARISIZ:', e.message, e.stack.split('\n').find(l => l.includes('hedef.mjs')), errors); process.exitCode = 1; }
finally { await browser.close(); srv.close(); }
