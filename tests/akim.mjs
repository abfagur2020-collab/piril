// Akım akışı: DC çözücü, çizim katmanı ve "Akımı göster" düğmesi. Çalıştır: node tests/akim.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href;

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'HATA ') + m); if (!c) fail++; };

const browser = await chromium.launch();
const errs = [];
async function open(reducedMotion = 'no-preference') {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion });
  page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(url);
  return page;
}
const page = await open();
const go = id => page.evaluate(id => start([id], id.split('-').slice(0, 2).join('-')), id);

// (a) Çözücü
const u = await page.evaluate(() => {
  const at = (fl, x, y) => fl.flatMap(f => f.p.map((p, k) => p[0] === x && p[1] === y ? f.v[k] : [])).flat();
  const s = flowOf(loop('9 V', [['R', 'R1', '1 kΩ'], ['R', 'R2', '2 kΩ']]));
  const pr = flowOf(par('12 V', [[['R', 'R1', '1 kΩ']], [['R', 'R2', '2 kΩ']]]));
  const through = (fl, x) => fl.find(f => f.p.some(p => p[0] === x && p[1] === 88))?.i; // dikey kolda direnç gövdesinin üst ucu
  const br = (v, R) => [['V', 20, 190, 20, 40, v], ['W', 20, 40, 230, 40], ['W', 20, 190, 230, 190], ['R', 110, 40, 110, 115, 'R1' + R[0]], ['R', 110, 115, 110, 190, 'R2' + R[1]],
    ['R', 230, 40, 230, 115, 'R3' + R[2]], ['R', 230, 115, 230, 190, 'R4' + R[3]], ['R', 110, 115, 230, 115, 'R5\n1 kΩ']];
  const led = flowOf(loop('9 V', [['R', 'R', '330 Ω'], ['LED', 'LED', '2 V']]));
  return {
    s, sAt: [at(s, 40, 40), at(s, 280, 40), at(s, 40, 180)],
    pr: pr && [through(pr, 150), through(pr, 260)],
    bad: [flowOf(loop('5 V', [['R', 'R', '1 kΩ'], ['C', 'C', '1 µF']])), flowOf(ZENER), flowOf(bjtDiv())],
    blankSeries: !!flowOf(loop('12 V', [['R', 'R1'], ['R', 'R2'], ['R', 'R3']])),
    blankBridge: flowOf(br('10 V', ['', '', '', ''])), fullBridge: !!flowOf(br('10 V', ['\n1 kΩ', '\n2 kΩ', '\n2 kΩ', '\n2 kΩ'])),
    ledRev: flowOf(loop('9 V', [['R', 'R', '330 Ω'], ['LED-', 'LED', '2 V']])), led: led && [Math.min(...led[0].v.slice(0, -1).filter(v => v > 0)), led[0].i],
    two: flowOf(QUESTIONS['1-4-2'].c),
    parse: [flowOf(loop('4,5 V', [['R', 'R', '1.500 Ω']]))?.[0].i, flowOf(loop('Paket\n110 V', [['R', 'R', '2,2 kΩ']]))?.[0].i, flowOf(loop('V_in\n12 V', [['R', 'R', '1 MΩ']]))?.[0].i]
  };
});
ok(u.s && u.s.length === 1, 'seri çevrim tek yol');
const f = u.s?.[0] || { p: [[]], v: [] };
ok(f.p[0][0] === 40 && f.p[0][1] === 40, 'akım kaynağın + ucundan (üstte) çıkar');
ok(f.p.at(-1)[0] === 40 && f.p.at(-1)[1] === 180, 'akım − ucuna döner');
ok(f.v[0] === 9 && f.v.at(-1) === 0 && f.v.every((v, k) => !k || v <= f.v[k - 1]), 'gerilim yol boyunca 9 V → 0 V düşer: ' + f.v.join(' '));
ok(u.sAt[1].includes(6), 'R1 ile R2 arası 6 V');
ok(Math.abs(f.i - 3) < 1e-9, 'akım 3 mA: ' + f.i);
ok(u.pr && Math.abs(u.pr[0] / u.pr[1] - 2) < 1e-6, `paralel kollar 1 kΩ : 2 kΩ → akım 2 : 1 (${u.pr})`);
ok(u.bad.every(x => x === null), 'kondansatör, zener, transistör → null');
ok(u.blankSeries, 'değersiz seri dirençler: yön değişemez, çözülür');
ok(u.blankBridge === null, 'değersiz köprü: R5 yönü değerlere bağlı → null');
ok(u.fullBridge, 'değerli köprü çözülür');
ok(u.ledRev === null, 'ters LED: akım yok → null');
ok(u.led && Math.abs(u.led[0] - 2) < .05 && Math.abs(u.led[1] - 7 / .33) < .5, `LED 2 V düşürür, akım ≈ 21 mA (${u.led})`);
ok(Math.abs(u.parse[0] - 3) < 1e-6 && Math.abs(u.parse[1] - 50) < .1 && Math.abs(u.parse[2] - .012) < 1e-6, `değer okuma: 1.500 Ω, 2,2 kΩ, 1 MΩ, 4,5 V, 110 V (${u.parse} mA)`);
ok(u.two?.[0].p.at(-1)[0] === 280 && u.two[0].v.at(-1) === 5, 'karşı bağlı 5 V kaynağın + ucuna akım girer (şarj)');

// (b) Hangi devreli sorular kendiliğinden akış alıyor?
const cov = await page.evaluate(() => {
  const all = Object.entries(QUESTIONS).filter(([, q]) => q.c);
  const tag = ([k, q]) => k + (q.t === 'ariza' ? ' (arıza)' : '');
  return { n: all.length, yes: all.filter(([, q]) => flowOf(q.c)).map(tag), no: all.filter(([, q]) => !flowOf(q.c)).map(tag) };
});
console.log(`\nDevreli soru: ${cov.n}, otomatik akış: ${cov.yes.length}, akışsız: ${cov.no.length}`);
console.log('Çözülen: ' + cov.yes.join(', '));
console.log('Çözülemeyen: ' + cov.no.join(', ') + '\n');
ok(cov.yes.length >= 15, 'en az 15 soru otomatik akış alıyor');

// (c) Arayüz
await go('3-1-2');
const btn = page.locator('#akb');
ok(await btn.count() === 1 && await btn.getAttribute('aria-pressed') === 'false', 'devre sorusunda "Akımı göster" düğmesi var, kapalı');
ok(await page.locator('.ckt .flow').count() === 0, 'başta akış katmanı yok');
const xp0 = await page.evaluate(() => S.xp);
await btn.click();
ok(await page.locator('.ckt .flow').count() === 1 && await page.locator('.flg').count() === 1 && await btn.getAttribute('aria-pressed') === 'true', 'düğme akışı ve açıklamayı açar');
ok(await page.locator('.ckt .flow animateMotion').count() > 0, 'oklar hareketli');
ok(/R1 ve R2 üzerinden/.test(await page.locator('.flg .vh').textContent()), 'ekran okuyucu metni yolu anlatır');
await btn.click();
ok(await page.locator('.ckt .flow').count() === 0 && await page.locator('.flg').count() === 0 && await btn.getAttribute('aria-pressed') === 'false', 'tekrar basınca kapanır');
ok(await page.evaluate(() => S.xp) === xp0, 'düğme XP değiştirmez');
await page.fill('#n', '1');
await page.click('#ok');
ok(await page.locator('.ckt .flow').count() === 1 && await btn.getAttribute('aria-pressed') === 'true', 'Kontrol et sonrası akış kendiliğinden açık');
ok(!(await btn.isDisabled()), 'cevaptan sonra düğme kullanılabilir');
await btn.click();
ok(await page.locator('.ckt .flow').count() === 0, 'cevaptan sonra da kapatılabilir');

await go('3-3-2');
ok(await page.locator('#akb').count() === 1, 'karma devre sorusunda düğme var');

await go('3-1-5');
ok(await page.locator('#akb').count() === 0, 'arıza sorusunda cevaptan önce düğme yok');
await page.locator('.seg button').nth(1).click().catch(() => {});
await page.locator('.part').first().click();
await page.click('#ok');
ok(await page.locator('.ckt .flow').count() === 0 && await page.locator('#akb').count() === 0, 'q.fl yoksa arıza cevabından sonra da akış yok');

// Elle yazılmış q.fl her şeyi geçer; arızada cevaptan sonra gösterilir, ölçüler ve işaretler kalır.
await page.evaluate(() => { QUESTIONS['3-1-5'].fl = [{ p: [[40, 40], [160, 40]], v: [12, 12], i: 1 }, { p: [[280, 180], [40, 180]], v: [0, 0], i: 1 }]; });
await go('3-1-5');
ok(await page.locator('#akb').count() === 0, 'q.fl olsa da arızada önce düğme yok');
await page.locator('.seg button').nth(1).click().catch(() => {});
await page.locator('.part').first().click();
await page.click('#ok');
ok(await page.locator('.ckt .flow').count() === 1 && await page.locator('#akb').getAttribute('aria-pressed') === 'true', 'arızada q.fl cevaptan sonra açılır');
ok(await page.locator('.part.good, .part.bad').count() > 0, 'arıza işaretleri yerinde');
await page.evaluate(() => { delete QUESTIONS['3-1-5'].fl; });

// Simülasyon: kaydırıcıyla gerilimler yeniden hesaplanır.
const sim = await page.evaluate(() => Object.keys(QUESTIONS).find(k => QUESTIONS[k].sim === 'bolucu'));
if (sim) {
  await go(sim);
  const mid = () => page.evaluate(() => [...document.querySelectorAll('#sv .flow .bd')].map(p => p.style.stroke).join());
  ok(await page.locator('#sv .flow').count() === 1, 'bölücü simülasyonunda akış var');
  const before = await mid();
  await page.locator('[data-p]').first().click();
  await page.locator('#s-R1').fill('1');
  ok(await page.locator('#sv .flow').count() === 1 && await mid() !== before, 'kaydırıcı renkleri günceller');
}

// Hareket azaltılmışsa oklar durur ama yön görünür kalır.
const still = await open('reduce');
await still.evaluate(() => start(['3-1-2'], '3-1'));
await still.click('#akb');
ok(await still.locator('.ckt .flow animateMotion').count() === 0 && await still.locator('.ckt .flow .ch[transform*="translate"]').count() > 3, 'hareket azaltılmış: duran ok uçları');

ok(errs.length === 0, 'konsol hatası yok' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close();
console.log(fail ? `\n${fail} HATA` : '\nHepsi tamam');
process.exit(fail ? 1 : 0);
