// Bulut yedeği: sahte Firebase ile giriş, birleştirme, otomatik yedek, çıkış, hesap silme. Çalıştır: node tests/bulut.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const src = fileURLToPath(new URL('../index.html', import.meta.url)), html = fs.readFileSync(src, 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'HATA ') + m); if (!c) fail++; };
const FBLINE = /const FB = (null|\{[^\n]*\});/;
ok(FBLINE.test(html), 'FB satırı var');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'akimli-')), 'index.html');
fs.writeFileSync(tmp, html.replace(FBLINE, "const FB = { apiKey: 'x', authDomain: 'x', projectId: 'x', appId: 'x' };"));
const MOCK = {
  app: `export const initializeApp = c => ({ c });`,
  auth: `const st = window.__fb ||= { user: JSON.parse(localStorage.__fbuser || 'null'), cbs: [] };
    const fire = () => { localStorage.__fbuser = JSON.stringify(st.user); st.cbs.forEach(cb => cb(st.user)); };
    export const getAuth = () => ({ get currentUser() { return st.user; } });
    export function onAuthStateChanged(a, cb) { st.cbs.push(cb); setTimeout(() => cb(st.user)); }
    export class GoogleAuthProvider { setCustomParameters() {} static credential(t) { return t; } }
    export async function signInWithCredential(a, c) { if (c !== 'tok') { const e = new Error('x'); e.code = 'auth/invalid-credential'; throw e; } st.user = { uid: 'u1', email: 'test@ornek.com' }; fire(); return { user: st.user }; }
    export async function signInWithPopup() { if (window.__popup) { const e = new Error('x'); e.code = window.__popup === 'closed' ? 'auth/popup-closed-by-user' : 'auth/popup-blocked'; throw e; } st.user = { uid: 'u1', email: 'test@ornek.com' }; fire(); }
    export async function signInWithRedirect() {}
    export async function signOut() { st.user = null; fire(); }
    export async function deleteUser() { window.__deleted = true; st.user = null; fire(); }
    export async function reauthenticateWithPopup() {}`,
  firestore: `const db = () => JSON.parse(localStorage.__fbdb || '{}'), put = d => localStorage.__fbdb = JSON.stringify(d);
    export const getFirestore = () => ({}); export const doc = (d, c, id) => c + '/' + id;
    export async function getDoc(p) { const d = db()[p]; return { exists: () => !!d, data: () => d }; }
    export async function setDoc(p, v, o) { const d = db(); d[p] = o?.merge ? { ...d[p], ...v } : v; put(d); window.__writes = (window.__writes || 0) + 1; }
    export async function deleteDoc(p) { const d = db(); delete d[p]; put(d); }`
};
const browser = await chromium.launch(), errs = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
let fbReq = 0;
await ctx.route('https://www.gstatic.com/firebasejs/**', r => {
  fbReq++; const n = /firebase-(\w+)\.js/.exec(r.request().url())[1];
  r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: MOCK[n] });
});
// Sahte Google Identity Services: düğme dokununca kimlik belgesi verir (__gisBad ise geçersiz belge).
let gisReq = 0;
await ctx.route('https://accounts.google.com/gsi/client', r => { gisReq++; r.fulfill({ status: 200, contentType: 'text/javascript', body: `window.google = { accounts: { id: {
  initialize(o) { window.__gis = o; },
  renderButton(el, o) { const b = document.createElement('button'); b.id = 'gmock'; b.textContent = 'Google ile oturum aç'; b.onclick = () => window.__gis.callback({ credential: window.__gisBad ? 'bad' : 'tok' }); el.append(b); } } } };` }); });
const page = await ctx.newPage();
page.on('console', m => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
const hesap = () => page.textContent('#hesap');

// 1. Yapılandırmasız kopya: Hesap bölümü yok, Firebase yüklenmez
const bos = path.join(path.dirname(tmp), 'bos.html'); fs.writeFileSync(bos, html.replace(FBLINE, 'const FB = null;'));
await page.goto(pathToFileURL(bos).href + '#profil'); await page.waitForSelector('h1');
ok(!(await page.locator('#hesap').count()) && fbReq === 0, 'FB null: Hesap bölümü yok, Firebase yüklenmedi');

// 2. Bu cihazda 10 XP, bulutta 500 XP'lik daha yeni kayıt
const url = pathToFileURL(tmp).href;
await page.goto(url);
await page.evaluate(() => {
  const s = fresh(); s.xp = 10; s.done = { '1-2': 3 }; s.bestStreak = 9; localStorage.setItem(KEY, JSON.stringify(s));
  const r = fresh(); r.xp = 500; r.done = { '1-1': 6, '1-2': 1 }; r.bestStreak = 4;
  localStorage.__fbdb = JSON.stringify({ 'users/u1': { s: JSON.stringify(r), t: Date.now() + 1e6, xp: 500 } });
});
await page.goto(url + '#profil'); await page.reload(); await page.waitForSelector('#hesap button');
ok(fbReq === 0, 'giriş yapılmamışken açılışta Firebase yüklenmez');
ok(/Google ile giriş yap/.test(await hesap()), 'giriş düğmesi görünür');
// İlk dokunuş Google'ın düğmesini getirir (GIS); o düğme kimlik belgesi verir, Firebase'e belgeyle girilir.
ok(gisReq === 0, 'Google betiği açılışta yüklenmez');
await page.click('#cin'); await page.waitForSelector('#gmock'); ok(gisReq === 1, 'ilk dokunuş Google düğmesini getirir');
await page.evaluate(() => window.__gisBad = true); await page.click('#gmock');
await page.waitForFunction(() => /tamamlanmadı/.test(document.getElementById('hesap').textContent));
ok(true, 'geçersiz belgede "Giriş tamamlanmadı"');
await page.evaluate(() => window.__gisBad = false); await page.click('#cin'); await page.waitForSelector('#gmock'); await page.click('#gmock');
await page.waitForFunction(() => /Son yedek/.test(document.getElementById('hesap')?.textContent || ''));
const m = await page.evaluate(() => ({ xp: S.xp, done: S.done, best: S.bestStreak, meta: JSON.parse(localStorage.getItem('piril-bulut')), cloud: JSON.parse(JSON.parse(localStorage.__fbdb)['users/u1'].s) }));
ok(m.xp === 500 && m.done['1-1'] === 6 && m.done['1-2'] === 3 && m.best === 9, 'birleştirme: yüksek XP temel, derslerin en iyisi, en uzun seri');
ok(m.meta.uid === 'u1' && m.cloud.xp === 500 && m.cloud.done['1-2'] === 3, 'birleşmiş ilerleme buluta yazıldı');
ok(/test@ornek\.com/.test(await hesap()), 'e-posta gösterilir');
await page.screenshot({ path: path.join(path.dirname(src), '..', 'shots', 'hesap.png') }).catch(() => {});

// 3. Soru çözünce birkaç saniye içinde otomatik yedek
const w0 = await page.evaluate(() => window.__writes);
await page.evaluate(() => location.hash = 'ders-1-1'); await page.waitForFunction(() => C && C.q);
const q = await page.evaluate(() => ({ t: C.q.t, a: C.q.a }));
ok(q.t === 'mc', 'ilk soru çoktan seçmeli');
await page.click(`.opt[data-i="${q.a}"]`); await page.click('#ok');
await page.waitForFunction(w => window.__writes > w, w0, { timeout: 8000 });
const c2 = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.__fbdb)['users/u1'].s).xp);
ok(c2 > 500, `cevaptan sonra otomatik yedek (bulut XP ${c2})`);

// 4. Başka cihazda ilerleme: açılışta çekilir
await page.evaluate(() => { const d = JSON.parse(localStorage.__fbdb), r = JSON.parse(d['users/u1'].s); r.xp = 900; d['users/u1'] = { s: JSON.stringify(r), t: Date.now() + 2e6, xp: 900 }; localStorage.__fbdb = JSON.stringify(d); });
fbReq = 0;
await page.goto(url + '#ana'); await page.reload();
await page.waitForFunction(() => S.xp === 900, null, { timeout: 8000 });
ok(fbReq > 0, 'giriş yapılmışsa açılışta otomatik bağlanır, başka cihazdaki 900 XP geldi');

// 5. Çıkış: bu cihazdaki ilerleme kalır
await page.evaluate(() => location.hash = 'profil'); await page.waitForSelector('#cout'); await page.click('#cout');
await page.waitForSelector('#cin');
ok(await page.evaluate(() => S.xp === 900 && !(localStorage.getItem('piril-bulut') || '').includes('u1')), 'çıkışta ilerleme cihazda kalır');

// 6. Hesap silme
await page.click('#cin'); await page.waitForSelector('#gmock'); await page.click('#gmock'); await page.waitForSelector('#cdel'); await page.click('#cdel');
await page.waitForFunction(() => window.__deleted && /silindi/.test(document.getElementById('hesap').textContent));
ok(await page.evaluate(() => !JSON.parse(localStorage.__fbdb)['users/u1'] && S.xp >= 900), 'hesap silinince bulut kaydı gider, cihazdaki ilerleme kalır');
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'profilde yatay taşma yok');

// 7. Seri birleşmesi: bitişik seriler zincirlenir, gerçekten kopan seri birleşmez; onarma ve söz birleşen seriyle tutarlı
const sk = await page.evaluate(() => { const t = dayNum(), f = o => ({ ...fresh(), ...o }), k = m => [m.last, m.streak, m.bestStreak, m.freeze, m.refill];
  // Yeni telefon, "Hesapsız başla", bugün 1 ders; bulutta dün biten 50 günlük seri ve 4 gün tutulmuş söz.
  const ph = f({ xp: 16, last: t, streak: 1, bestStreak: 1, day: t, dayXp: 16 }), cl = f({ xp: 900, last: t - 1, streak: 50, bestStreak: 50, freeze: false, refill: 3, pledge: [t - 4, 4, t - 1, 0] });
  const np = mergeState(ph, cl), np2 = mergeState(cl, ph); pledgeTick(np, t);
  // İki cihaz ardışık günlerde: A dün (5 gün), B bugün yeni (1 gün)
  const ab = mergeState(f({ last: t - 1, streak: 5, bestStreak: 5 }), f({ last: t, streak: 1, bestStreak: 1 }));
  // Ara gün eskinin kaçırma hakkıyla kapanır; hakkı yoksa birleşmez
  const fz = mergeState(f({ last: t - 2, streak: 8, bestStreak: 8, freeze: true }), f({ last: t, streak: 1, bestStreak: 1 }));
  const nofz = mergeState(f({ last: t - 2, streak: 8, bestStreak: 8, freeze: false, refill: 4 }), f({ last: t, streak: 1, bestStreak: 1 }));
  // Gerçekten kopmuş: 3 gün boşluk → yalnız yeni seri, en uzun seri korunur
  const gap = mergeState(f({ xp: 900, last: t - 4, streak: 50, bestStreak: 50, freeze: true }), f({ xp: 5, last: t, streak: 1, bestStreak: 1 }));
  // Aynı gün: uzun olan
  const same = mergeState(f({ last: t, streak: 3, bestStreak: 3 }), f({ last: t, streak: 9, bestStreak: 9, freeze: false, refill: 2 }));
  // Bir cihaz seriyi kopmuş sanıp onarma önermişken öteki cihaz o günleri çalışmış: öneri kalkar, söz bozulmaz
  const rpA = f({ last: t, streak: 1, rpFor: t - 3, rpDay: t, rpLost: 12, rpN: 1 }), rpB = f({ last: t - 1, streak: 14, bestStreak: 14 }), rp = mergeState(rpA, rpB);
  const rpGap = mergeState(rpA, f({ last: t - 3, streak: 12, bestStreak: 12, freeze: false, rpFor: -1 }));
  return { np: [...k(np), np.pledge], np2: k(np2), ab: k(ab), fz: k(fz), nofz: k(nofz), gap: k(gap), same: k(same), rp: [rp.streak, rp.rpLost, liveStreak(rp, t)], rpGap: [rpGap.streak, rpGap.rpLost], t }; });
ok(JSON.stringify(sk.np) === JSON.stringify([sk.t, 51, 51, false, 2, [sk.t - 4, 5, sk.t, 0]]), `yeni telefon + bulut: seri 51, hak eski seriden (2 gün kaldı), söz sürer (5/7) ${JSON.stringify(sk.np)}`);
ok(JSON.stringify(sk.np2) === JSON.stringify(sk.np.slice(0, 5)), 'birleşme sıradan bağımsız');
ok(sk.ab[1] === 6 && sk.ab[0] === sk.t, `ardışık günlerde iki cihaz: 5 + 1 = 6 (${sk.ab})`);
ok(sk.fz[1] === 9 && sk.fz[3] === false && sk.fz[4] === 7, `ara gün kaçırma hakkıyla: 8 + 1 = 9, hak harcandı (${sk.fz})`);
ok(sk.nofz[1] === 1, `hakkı yoksa ara gün seriyi koparır (${sk.nofz})`);
ok(sk.gap[1] === 1 && sk.gap[2] === 50 && sk.gap[0] === sk.t, `gerçekten kopmuş seri: yalnız yeni seri, en uzun seri 50 kalır (${sk.gap})`);
ok(sk.same[1] === 9 && sk.same[3] === false && sk.same[4] === 2, `aynı gün: uzun olan (${sk.same})`);
ok(sk.rp[0] === 15 && sk.rp[1] === 0 && sk.rp[2] === 15, `öteki cihaz arayı kapattıysa onarma önerisi kalkar (${sk.rp})`);
ok(sk.rpGap[0] === 1 && sk.rpGap[1] === 12, `gerçekten kopmuşsa onarma önerisi kalır (${sk.rpGap})`);

// 8. Ayarlar: hedef, ses ve hatırlatıcı her biri en son değiştirildiği cihazdan gelir (XP'den bağımsız)
const st = await page.evaluate(() => { const f = o => ({ ...fresh(), ...o }), now = Date.now(), g = m => [m.goal, m.snd, m.rem];
  const A = f({ xp: 900, goal: 30, snd: true, rem: 1, setAt: [now - 5e3, now - 1e3, now - 9e3] }), B = f({ xp: 10, goal: 60, snd: false, rem: 0, setAt: [now - 1e3, now - 5e3, now - 2e3] });
  const ids = Object.keys(QUESTIONS), P = v => parseState(JSON.stringify({ setAt: v }), ids).setAt;
  // Gerçek akış: Profil'den değişen ayar zamanlanır
  S.setAt = [0, 0, 0]; location.hash = 'profil';
  return { ab: g(mergeState(A, B)), ba: g(mergeState(B, A)), at: mergeState(A, B).setAt, tie: g(mergeState(f({ xp: 9, goal: 60 }), f({ xp: 1, goal: 20, snd: false }))), now,
    ps: [P([now - 1, 5, 0]), P([now + 36e5, -1, 'x']), P([NaN, null, 1]), P('x'), P([1, 2])] }; });
ok(JSON.stringify(st.ab) === '[60,true,0]' && JSON.stringify(st.ba) === '[60,true,0]', `her ayar en yeni cihazdan (${st.ab} / ${st.ba})`);
ok(st.at.join() === [st.now - 1e3, st.now - 1e3, st.now - 2e3].join(), 'ayar zamanları da birleşir');
ok(JSON.stringify(st.tie) === '[60,true,0]', 'zaman yoksa XP\'si yüksek olan (eski davranış)');
ok(JSON.stringify(st.ps) === JSON.stringify([[st.now - 1, 5, 0], [0, 0, 0], [0, 0, 1], [0, 0, 0], [1, 2, 0]]), `parseState: geçersiz/gelecekteki ayar zamanları 0 (${JSON.stringify(st.ps)})`);
await page.waitForSelector('#hedef'); const t0 = Date.now();
await page.selectOption('#hedef', '60'); await page.selectOption('#rem', '0'); await page.click('#snd');
const sa = await page.evaluate(() => [S.goal, S.snd, S.rem, ...S.setAt]);
await page.waitForTimeout(300); errs.splice(0, errs.length, ...errs.filter(e => !/ServiceWorkerRegistration.*protocol/.test(e))); // file:// ortamı: hatırlatıcı kapatılınca SW kaydı bulunamaz
ok(sa[0] === 60 && sa.slice(3).every(v => v >= t0 - 1000 && v <= Date.now() + 1000), `Profil'de değişen hedef, ses ve hatırlatıcı zamanlanır (${sa})`);
ok(!errs.length, 'konsol hatası yok ' + errs.join(' | '));
await browser.close();
console.log(fail ? `${fail} hata` : 'Hepsi geçti'); process.exit(fail ? 1 : 0);
