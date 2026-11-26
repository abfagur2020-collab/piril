// Dokun-öğren terimleri ve Sözlük. node tests/sozluk.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href;
const shots = process.argv[2];

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'HATA ') + m); if (!c) fail++; };

const browser = await chromium.launch();
const errs = [];
async function open(scheme) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => localStorage.setItem('piril-hos', '1'));
  await page.emulateMedia({ colorScheme: scheme });
  page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(url);
  return page;
}
const at = (page, h, sel) => page.waitForFunction(([h, sel]) => location.hash.slice(1) === h && !!document.querySelector(sel), [h, sel], { timeout: 3000 }).then(() => true, () => false);

const page = await open('light');

// (a) txg birim denetimleri
const u = await page.evaluate(() => {
  const P = h => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  const terms = h => [...P(h).querySelectorAll('button.term')].map(b => [b.textContent, TERMS[b.dataset.t][0]]);
  const a = txg('Seri dirençlerde akım aynıdır.');
  const b = txg('İç direnç gerilimi düşürür.');
  const c = txg('Direnç büyürse direnç ısınır, dirence dikkat.');
  const d = txg('Aktif bölgede V_CE yaklaşık 6 V olur.');
  const d2 = txg('V_CE(doyum) ≈ 0,2 V, β_zorlanmış = 10');
  const e = txg('<img src=x onerror="alert(1)"> direnç <b title="direnç">');
  const pe = P(e);
  return {
    a: terms(a), b: terms(b), c: terms(c), d, d2, dT: terms(d), e, eImg: pe.querySelectorAll('img,b').length, eTags: [...pe.querySelectorAll('*')].map(x => x.tagName),
    attrs: [...pe.querySelectorAll('*')].every(x => [...x.attributes].every(at => !/term|</.test(at.value) || at.name === 'class')),
    plain: txg('Hiç terim içermeyen bir cümle: elma armut.') === tx('Hiç terim içermeyen bir cümle: elma armut.'),
    inword: terms(txg('Ayrıntılı açıklama')).length,
    ohm: terms(txg('470 Ω direnç, ω = 314 rad/s')).map(x => x[0]),
    shared: (() => { const s = new Set(); txg('direnç', s); return terms(txg('bir direnç daha', s)).length; })()
  };
});
ok(u.a.some(([t, n]) => t === 'dirençlerde' && n.startsWith('Direnç')), `"Seri dirençlerde" içinde "dirençlerde" terim (${JSON.stringify(u.a)})`);
ok(u.a.some(([t]) => t === 'Seri'), '"Seri" de terim');
ok(u.b.some(([t, n]) => t === 'İç direnç' && n.startsWith('İç direnç')), `"İç direnç" Türkçe İ ile eşleşir (${JSON.stringify(u.b)})`);
ok(u.c.filter(([, n]) => n.startsWith('Direnç')).length === 1 && u.c[0][0] === 'Direnç', `aynı terimin yalnız ilk geçişi sarılır (${JSON.stringify(u.c)})`);
ok(/V<sub>CE<\/sub>/.test(u.d) && u.dT.some(([t]) => t === 'VCE'), 'V_CE alt simgeyle çizilir ve terim düğmesi olur');
ok(/V<sub>CE<\/sub>(<\/button>)?\(/.test(u.d2) && /β<sub>zorlanmış<\/sub>/.test(u.d2), `β_zorlanmış bölünmez (${u.d2})`);
ok(u.eImg === 0 && u.eTags.every(t => t === 'BUTTON' || t === 'SUB') && u.e.includes('&lt;img'), 'etiket metni kaçışlı kalır, img/b oluşmaz');
ok(u.attrs, 'öznitelik içine terim girmez');
ok(u.plain, 'terimsiz metinde txg = tx');
ok(u.inword === 0, 'kelime içinde eşleşme yok ("Ayrıntılı" içinde "ayrı"/"akım" yok)');
ok(u.ohm.join() === 'direnç,ω', `Ω (ohm) açısal hız sanılmaz (${u.ohm})`);
ok(u.shared === 0, 'paylaşılan küme: ekranda ikinci geçiş sarılmaz');

// (b) kapsam ve veri
const cov = await page.evaluate(() => {
  const has = s => /class="term"/.test(txg(s));
  const qs = Object.values(QUESTIONS), ks = LESSONS.flatMap(l => l.k || []);
  const keys = TERMS.flatMap(t => t[1].split('|').map(k => k.replace(/\*$/, '')).map(k => k.includes('_') || !/[a-zçğıöşüé]/.test(k) ? k : k.toLocaleLowerCase('tr')));
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i), titles = TERMS.map(t => t[0]);
  return { n: TERMS.length, q: qs.filter(q => has(q.q)).length, qn: qs.length, e: qs.filter(q => has(q.e)).length, k: ks.filter(c => has(c.p)).length, kn: ks.length,
    empty: TERMS.filter(t => !t[0] || !t[1] || !(t[2] || '').trim()).length, dup, tdup: titles.filter((t, i) => titles.indexOf(t) !== i),
    unused: TERMS.filter((t, i) => ![...qs.flatMap(q => [q.q, q.e]), ...ks.map(c => c.p)].some(s => txg(s).includes(`data-t="${i}"`))).map(t => t[0]) };
});
console.log(`     ${cov.n} terim; soru metni ${cov.q}/${cov.qn}, açıklama ${cov.e}/${cov.qn}, konu kartı ${cov.k}/${cov.kn} en az bir terim içeriyor`);
console.log(`     metinde hiç geçmeyen ${cov.unused.length} terim (yalnız Sözlük'te): ${cov.unused.join(', ')}`);
ok(cov.empty === 0, 'her terimin başlığı, anahtarı ve tanımı var');
ok(!cov.dup.length, `yinelenen anahtar yok ${cov.dup.join(', ')}`);
ok(!cov.tdup.length, `yinelenen başlık yok ${cov.tdup.join(', ')}`);
ok(cov.q / cov.qn > 0.6 && cov.k / cov.kn > 0.9, 'kapsam: soruların %60\'ından, kartların %90\'ından fazlası');

// (c) arayüz: ilk sorusu çoktan seçmeli ve başlığında terim olan ders
const L = await page.evaluate(() => LESSONS.find(l => l.qs[0].t === 'mc' && l.op !== false && /class="term"/.test(txg(l.qs[0].q)) && unlocked(l)).id);
await page.evaluate(L => location.hash = 'ders-' + L, L);
ok(await at(page, 'ders-' + L, 'h1.q .term'), `soru başlığında terim düğmesi var (ders ${L})`);
const t0 = await page.$eval('h1.q .term', b => ({ t: b.textContent, n: TERMS[b.dataset.t][0], d: TERMS[b.dataset.t][2] }));
await page.click('h1.q .term');
const pop = await page.evaluate(() => { const p = document.getElementById('tpop'); return { vis: !p.hidden, txt: p.textContent, foc: document.activeElement === p, exp: document.querySelector('h1.q .term').getAttribute('aria-expanded'), hash: location.hash }; });
ok(pop.vis && pop.txt.includes(t0.d.slice(0, 20)) && pop.foc && pop.exp === 'true', `"${t0.t}" dokununca tanım açılır, odak kartta`);
ok(pop.hash === '#ders-' + L, 'dokunmak ekranı değiştirmez');
if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/sozluk-terim-acik.png` }); }
await page.keyboard.press('Escape');
const closed = await page.evaluate(() => ({ h: document.getElementById('tpop').hidden, foc: document.activeElement?.classList.contains('term'), exp: document.querySelector('h1.q .term').getAttribute('aria-expanded') }));
ok(closed.h && closed.foc && closed.exp === 'false', 'Esc kapatır, odak terime döner');
// Dışarı dokununca kapanır; seçenek tıklaması yine çalışır.
await page.click('h1.q .term');
await page.click('.opt');
const out = await page.evaluate(() => ({ h: document.getElementById('tpop').hidden, sel: !!document.querySelector('.opt[aria-pressed=true]') }));
ok(out.h && out.sel, 'dışarı dokunmak kartı kapatır, seçenek seçilir');
// "Sözlükte aç": ders bozulmadan üstte açılır.
await page.click('h1.q .term');
await page.click('#tpgo');
const ov = await page.evaluate(() => ({ o: !!document.getElementById('szo'), on: document.querySelector('#szo .sze.on dt')?.textContent, hash: location.hash }));
ok(ov.o && ov.on && ov.hash === '#ders-' + L, `Sözlükte aç: sözlük üstte, terim işaretli (${ov.on})`);
await page.click('#szx');
ok(await page.evaluate(() => !document.getElementById('szo') && !!document.querySelector('.opt[aria-pressed=true]')), 'X sözlüğü kapatır, soru olduğu gibi durur');
// Cevaptan sonra başlıktaki terim hâlâ açılır; yanlış açıklamada terim var.
await page.evaluate(() => { const o = [...document.querySelectorAll('.opt')]; o.find(b => +b.dataset.i !== C.q.a)?.click(); });
await page.click('#ok').catch(() => {});
ok(await page.evaluate(() => !document.querySelector('h1.q .term').disabled), 'cevaptan sonra başlıktaki terim kilitlenmez');

// Konu anlatımı kartlarında terim
await page.evaluate(() => location.hash = 'konu-3-1');
ok(await at(page, 'konu-3-1', '.kart p .term'), 'konu kartında terim düğmesi var');
ok(await page.evaluate(() => !document.querySelector('.frm .term,.fig .term,h2 .term')), 'formül, devre ve başlıkta terim yok');

// Profil → Sözlük, arama
await page.evaluate(() => location.hash = 'profil');
await at(page, 'profil', '[data-go="sozluk"]');
await page.click('[data-go="sozluk"]');
ok(await at(page, 'sozluk', '#szq'), 'Profil\'den Sözlük açılır');
await page.fill('#szq', 'KAPASİT');
const sr = await page.evaluate(() => ({ vis: [...document.querySelectorAll('.sze:not([hidden]) dt')].map(e => e.textContent), n: document.getElementById('szn').textContent }));
ok(sr.vis.some(t => t.startsWith('Kapasitans')), `"KAPASİT" araması kapasitansı bulur (${sr.vis.length}: ${sr.n})`);
await page.fill('#szq', 'zzqx');
ok(await page.evaluate(() => !document.querySelector('.sze:not([hidden])') && /eşleşen/.test(document.getElementById('szn').textContent)), 'sonuçsuz aramada uyarı');
await page.fill('#szq', '');
const az = await page.$$eval('.szg h2', h => h.map(x => x.textContent));
ok(az[0] === 'A' && az.includes('Ç') && az.includes('İ') && az.indexOf('I') < az.indexOf('İ'), `A–Z (Türkçe) gruplar: ${az.join(' ')}`);
const wide = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
ok(wide, 'yatay kaydırma yok');
if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/sozluk-liste.png` }); }
await page.click('[data-go="profil"]');
ok(await at(page, 'profil', '[data-go="sozluk"]'), 'X Profil\'e döner');

if (shots) {
  const dk = await open('dark');
  await dk.evaluate(L => location.hash = 'ders-' + L, L); await at(dk, 'ders-' + L, 'h1.q .term');
  await dk.click('h1.q .term'); await dk.waitForTimeout(400); await dk.screenshot({ path: `${shots}/sozluk-terim-acik-koyu.png` });
  await dk.evaluate(() => location.hash = 'sozluk'); await at(dk, 'sozluk', '#szq'); await dk.waitForTimeout(400);
  await dk.screenshot({ path: `${shots}/sozluk-liste-koyu.png` });
}

ok(!errs.length, `konsol hatası yok ${errs.join(' | ')}`);
await browser.close();
process.exit(fail ? 1 : 0);
