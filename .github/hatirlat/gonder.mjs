// Günlük hatırlatma: Firestore'daki aboneliği olan kullanıcılara, o gün hedefini tutturmadılarsa Web Push gönderir.
// GitHub Actions her akşam çalıştırır (.github/workflows/hatirlat.yml). Karar, sw.js'teki reminderText ile aynıdır
// (Android'de telefonun kendi yaptığı kontrol), metin ve sıklık iki yerde aynı kalsın diye oradan okunur.
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const sw = fs.readFileSync(new URL('sw.js', root), 'utf8'), html = fs.readFileSync(new URL('index.html', root), 'utf8');
const src = /function reminderText[\s\S]*?\n}\n/.exec(sw)[0];
export const reminderText = new Function(src + 'return reminderText;')();
export const GOAL = +/GOAL = (\d+)/.exec(html)[1];
export const VAPID_PUBLIC = /const VAPID = '([^']+)'/.exec(html)[1];

// Türkiye saatiyle bugünün gün numarası (uygulamadaki dayNum ile aynı ölçek) ve saat.
export function trNow(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(x => [x.type, x.value]));
  return { today: Date.UTC(+p.year, +p.month - 1, +p.day) / 864e5, hour: +p.hour };
}

// docs: [{ id, s, p, ps }]; send(sub, payload) atar ya da { statusCode } ile hata fırlatır; update(id, alanlar).
export async function run({ docs, send, update, now = new Date(), rnd = Math.random }) {
  const { today, hour } = trNow(now), out = { sent: 0, skip: 0, gone: 0, fail: 0 };
  for (const d of docs) {
    if (!d.p) { out.skip++; continue; }
    let st, sub; try { st = JSON.parse(d.s); sub = JSON.parse(d.p); } catch { out.skip++; continue; }
    const sum = { rem: st.rem, day: st.day, dayXp: st.dayXp, goal: GOAL, last: st.last, streak: st.streak, freeze: st.freeze, wrong: (st.wrong || []).length };
    const body = reminderText(sum, today, hour, typeof d.ps === 'number' ? d.ps : null, rnd());
    if (!body) { out.skip++; continue; }
    try { await send(sub, JSON.stringify({ title: 'Akımlı', body })); await update(d.id, { ps: today }); out.sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { await update(d.id, { p: '' }); out.gone++; } else out.fail++; }
  }
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { default: admin } = await import('firebase-admin'), { default: webpush } = await import('web-push');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
  webpush.setVapidDetails('https://abfagur2020-collab.github.io/piril/', VAPID_PUBLIC, process.env.VAPID_PRIVATE);
  const db = admin.firestore(), snap = await db.collection('users').where('p', '>', '').get();
  const out = await run({
    docs: snap.docs.map(x => ({ id: x.id, ...x.data() })),
    send: (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: 'normal' }),
    update: (id, f) => db.collection('users').doc(id).update(f)
  });
  console.log(`Abonelik: ${snap.size}, gönderilen: ${out.sent}, gerek yok: ${out.skip}, süresi dolan: ${out.gone}, hata: ${out.fail}`);
  if (out.fail) process.exitCode = 1;
}
