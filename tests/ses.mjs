// Ses efektleri: doğru/yanlış/ders sonu/3'lü seri/görev sesleri tek snd() kapısından geçer; ayar kapalıyken ses çalmaz;
// ayar kalıcıdır ve parseState bozuk değeri atar; AudioContext yoksa hata yok; otomatik testlerde (webdriver) varsayılan olarak sessiz.
// Çalıştır: node tests/ses.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href, shots = process.argv[2];
const browser = await chromium.launch(), errors = [];
const answer = (page, right) => page.evaluate(right => { const q = C.q;
  C.ans = !right ? (q.t === 'mc' ? (q.a + 1) % q.o.length : q.t === 'sira' ? q.o.map((_, i) => q.o.length - 1 - i) : q.t === 'ariza' ? '__yok__' : q.t === 'kur' ? ['siyah', 'siyah', 'siyah'] : '999999')
    : q.t === 'mc' || q.t === 'ariza' ? q.a : q.t === 'sira' ? q.o.map((_, i) => i) : q.t === 'kur' ? q.a : String(q.a).replace('.', ','); check(); }, right);
// Sahte AudioContext: oluşturulan osilatörleri sayar; gerçek ses çıkmaz.
const fakeAudio = () => {
  window.__osc = []; window.__ac = 0; window.__resume = 0;
  window.AudioContext = class { constructor() { window.__ac++; this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
    resume() { window.__resume++; this.state = 'running'; return Promise.resolve(); }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { const o = { type: '', frequency: { setValueAtTime(f) { o.f = f; }, exponentialRampToValueAtTime() {} }, connect() {}, start(t) { o.t = t; }, stop(t) { o.e = t; } }; window.__osc.push(o); return o; } };
};
const human = () => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
const spy = page => page.evaluate(() => { const o = window.snd; window.__log = []; window.snd = (n, a) => { window.__log.push(n); return o(n, a); }; });
const newPage = async (ctx, scheme) => { const p = await ctx.newPage(); if (scheme) await p.emulateMedia({ colorScheme: scheme }); p.on('pageerror', e => errors.push(String(e))); p.on('console', m => m.type() === 'error' && errors.push(m.text())); return p; };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem('piril-hos', '1'));
  await ctx.addInitScript(fakeAudio); await ctx.addInitScript(human);
  const page = await newPage(ctx);
  await page.goto(url);
  assert.equal(await page.evaluate(() => S.snd), true, 'varsayılan açık');
  assert.equal(await page.evaluate(() => window.__ac), 0, 'dokunmadan ses bağlamı kurulmaz');

  // (a) Ses tablosu: her ses 0,8 s'nin altında
  const len = await page.evaluate(() => Object.fromEntries(Object.entries(SND).map(([k, n]) => [k, Math.max(...n.map(x => x[1] + x[2]))])));
  for (const [k, v] of Object.entries(len)) assert.ok(v <= .8, `${k} ${v} s`);
  assert.deepEqual(Object.keys(len).sort(), ['bitti', 'dogru', 'jeton', 'seri', 'yanlis']);

  // (b) İlk dokunuş bağlamı açar (iPhone): tek bağlam, resume çağrılır
  await page.mouse.click(5, 400);
  assert.deepEqual(await page.evaluate(() => [window.__ac, window.__resume, actx.state]), [1, 1, 'running'], 'ilk dokunuşta açıldı');
  await page.mouse.click(5, 400);
  assert.equal(await page.evaluate(() => window.__ac), 1, 'tek bağlam');

  // (c) Derste: doğru → dogru, yanlış → yanlis, 3 arka arkaya → seri, görev → jeton, ders sonu → bitti
  await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q);
  await page.evaluate(() => { window.dayQuests = () => [QUESTS[0][0], QUESTS[1][0], QUESTS[2][0]]; });
  await spy(page);
  const n = await page.evaluate(() => C.total);
  await answer(page, true);
  assert.deepEqual(await page.evaluate(() => window.__log), ['dogru']);
  assert.deepEqual(await page.evaluate(() => window.__osc.map(o => o.f)), [784, 1175], 'iki notalı ding');
  await page.click('#nx'); await answer(page, false);
  assert.deepEqual(await page.evaluate(() => window.__log), ['dogru', 'yanlis']);
  for (let i = 0; i < 3; i++) { await page.click('#nx'); await answer(page, true); }
  assert.deepEqual(await page.evaluate(() => window.__log.filter(x => x !== 'jeton')), ['dogru', 'yanlis', 'dogru', 'dogru', 'seri', 'dogru'], '3 arka arkaya doğruda kutlama sesi (0,22 s sonra çalar)');
  assert.equal(await page.evaluate(() => window.__log.filter(x => x === 'jeton').length), 1, '"3 soruyu doğru çöz" bitince jeton sesi');
  await page.waitForTimeout(2900); // "3 arka arkaya" görevi kutlamadan sonra bildirilir
  assert.equal(await page.evaluate(() => window.__log.filter(x => x === 'jeton').length), 2, 'ikinci görevde yine jeton');
  assert.equal(await page.locator('.qtoast').count(), 1);
  for (let i = 5; i < n; i++) { await page.click('#nx'); await answer(page, true); }
  await page.click('#nx');
  assert.equal(await page.evaluate(() => window.__log.at(-1)), 'bitti', 'ders sonu melodisi');
  assert.ok(await page.locator('.end h1').count());
  const osc = await page.evaluate(() => window.__osc.every(o => o.e > o.t && o.e - o.t <= .82));
  assert.ok(osc, 'her nota kısa');

  // (d) Profil: gerçek, erişilebilir anahtar; kapatınca çalmaz; ayar kalıcı
  await page.goto(url + '#profil');
  const sw = page.getByRole('switch', { name: 'Ses efektleri' });
  assert.equal(await sw.isChecked(), true);
  await sw.click();
  assert.equal(await page.evaluate(() => [S.snd, JSON.parse(localStorage.getItem('piril-v1')).snd].join()), 'false,false', 'kapalı kaydedildi');
  // Açılışta kayıttan okunur (headless Chromium'da file:// localStorage sekmeler/yenileme arasında güvenilmez; açılış yolu doğrudan sınanır)
  assert.equal(await page.evaluate(() => { S = parseState(localStorage.getItem(KEY), Object.keys(QUESTIONS)); route(); return [S.snd, document.querySelector('#snd').checked, document.querySelector('#snd').getAttribute('aria-checked')].join(); }), 'false,false,', 'kayıttan kapalı açılır');
  await page.goto(url + '#ders-1-1'); await page.waitForFunction(() => C && C.q);
  await page.mouse.click(5, 400);
  const before = await page.evaluate(() => [window.__ac, window.__osc.length]);
  await answer(page, true); await page.click('#nx'); await answer(page, false);
  for (const s of ['dogru', 'yanlis', 'seri', 'jeton', 'bitti']) await page.evaluate(s => snd(s), s);
  await page.evaluate(() => party(3));
  assert.deepEqual(await page.evaluate(() => [window.__ac, window.__osc.length]), before, 'ayar kapalı: ses yok, bağlam kurulmaz');
  // Klavyeyle geri aç: açınca kısa bir örnek ses
  await page.goto(url + '#profil');
  const sw2 = page.getByRole('switch', { name: 'Ses efektleri' });
  await sw2.focus(); await page.keyboard.press('Space');
  assert.equal(await sw2.isChecked(), true);
  assert.deepEqual(await page.evaluate(() => [S.snd, window.__osc.length > 0]), [true, true], 'açınca örnek ses');

  // (e) parseState: yalnız true/false kabul
  const ps = await page.evaluate(() => { const P = v => parseState(JSON.stringify({ xp: 1, done: {}, snd: v }), Object.keys(QUESTIONS)).snd;
    return [P(false), P(true), P('false'), P(0), P(1), P(null), P({}), P([]), parseState('{"xp":1,"done":{}}', []).snd, parseState('bozuk', []).snd]; });
  assert.deepEqual(ps, [false, true, true, true, true, true, true, true, true, true], 'bozuk değer varsayılana döner');

  // (f) AudioContext yok (eski tarayıcı): hata yok, ders normal akar
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx2.addInitScript(() => { localStorage.setItem('piril-hos', '1'); delete window.AudioContext; delete window.webkitAudioContext; });
  await ctx2.addInitScript(human);
  const p2 = await newPage(ctx2);
  await p2.goto(url + '#ders-1-1'); await p2.waitForFunction(() => C && C.q);
  assert.equal(await p2.evaluate(() => typeof window.AudioContext), 'undefined');
  await p2.mouse.click(5, 400);
  for (let i = 0; i < 3; i++) { await answer(p2, i !== 1); await p2.click('#nx'); }
  for (const s of ['dogru', 'yanlis', 'seri', 'jeton', 'bitti', 'yok']) await p2.evaluate(s => snd(s), s);
  assert.equal(await p2.evaluate(() => actx), null);
  // Bağlam hata atarsa da sessizce geçer
  await p2.evaluate(() => { window.AudioContext = class { constructor() { throw new Error('izin yok'); } }; });
  await p2.evaluate(() => snd('dogru'));
  await answer(p2, true);
  await ctx2.close();

  // (g) Otomatik test (webdriver) varsayılan olarak sessiz
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx3.addInitScript(() => localStorage.setItem('piril-hos', '1')); await ctx3.addInitScript(fakeAudio);
  const p3 = await newPage(ctx3);
  await p3.goto(url + '#ders-1-1'); await p3.waitForFunction(() => C && C.q);
  await p3.mouse.click(5, 400); await answer(p3, true);
  assert.deepEqual(await p3.evaluate(() => [window.__ac, window.__osc.length]), [0, 0], 'webdriver: ses yok');
  await ctx3.close();

  // Ekran görüntüleri: Profil'deki ses anahtarı
  if (shots) for (const scheme of ['light', 'dark']) for (const on of [true, false]) {
    const p = await newPage(ctx, scheme); await p.goto(url + '#profil');
    await p.evaluate(on => { S.snd = on; save(); route(); }, on);
    await p.locator('#snd').scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -200));
    if (!on) await p.focus('#snd');
    await p.waitForTimeout(300); await p.screenshot({ path: `${shots}/ses-profil-${on ? 'acik' : 'kapali'}-${scheme}.png` });
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'yatay kaydırma yok');
    const box = await p.locator('label.sel:has(#snd)').boundingBox(); assert.ok(box.height >= 44, 'dokunma alanı');
    await p.close();
  }
  assert.deepEqual(errors, []);
  console.log('ses: tamam');
} finally { await browser.close(); }
