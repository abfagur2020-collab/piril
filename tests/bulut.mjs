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
    export class GoogleAuthProvider { setCustomParameters() {} }
    export async function signInWithPopup() { if (window.__popup === 'closed') { const e = new Error('x'); e.code = 'auth/popup-closed-by-user'; throw e; } st.user = { uid: 'u1', email: 'test@ornek.com' }; fire(); }
    export async function signInWithRedirect() {}
    export async function signOut() { st.user = null; fire(); }
    export async function deleteUser() { window.__deleted = true; st.user = null; fire(); }
    export async function reauthenticateWithPopup() {}`,
  firestore: `const db = () => JSON.parse(localStorage.__fbdb || '{}'), put = d => localStorage.__fbdb = JSON.stringify(d);
    export const getFirestore = () => ({}); export const doc = (d, c, id) => c + '/' + id;
    export async function getDoc(p) { const d = db()[p]; return { exists: () => !!d, data: () => d }; }
    export async function setDoc(p, v) { const d = db(); d[p] = v; put(d); window.__writes = (window.__writes || 0) + 1; }
    export async function deleteDoc(p) { const d = db(); delete d[p]; put(d); }`
};
const browser = await chromium.launch(), errs = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
let fbReq = 0;
await ctx.route('https://www.gstatic.com/firebasejs/**', r => {
  fbReq++; const n = /firebase-(\w+)\.js/.exec(r.request().url())[1];
  r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: MOCK[n] });
});
const page = await ctx.newPage();
page.on('console', m => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
const hesap = () => page.textContent('#hesap');

// 1. Yapılandırmasız gerçek dosya: Hesap bölümü yok, Firebase yüklenmez
await page.goto(pathToFileURL(src).href + '#profil'); await page.waitForSelector('h1');
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
await page.evaluate(() => window.__popup = 'closed'); await page.click('#cin');
await page.waitForFunction(() => /iptal/.test(document.getElementById('hesap').textContent));
ok(true, 'pencere kapatılınca "Giriş iptal edildi"');
await page.evaluate(() => window.__popup = ''); await page.click('#cin');
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
await page.click('#cin'); await page.waitForSelector('#cdel'); await page.click('#cdel');
await page.waitForFunction(() => window.__deleted && /silindi/.test(document.getElementById('hesap').textContent));
ok(await page.evaluate(() => !JSON.parse(localStorage.__fbdb)['users/u1'] && S.xp >= 900), 'hesap silinince bulut kaydı gider, cihazdaki ilerleme kalır');
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'profilde yatay taşma yok');
ok(!errs.length, 'konsol hatası yok ' + errs.join(' | '));
await browser.close();
console.log(fail ? `${fail} hata` : 'Hepsi geçti'); process.exit(fail ? 1 : 0);
