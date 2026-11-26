// Sunucu hatırlatması: kime gönderilir, kime gönderilmez; süresi dolan abonelik silinir. Çalıştır: node tests/hatirlat.mjs
import assert from 'node:assert/strict';
import { run, trNow, GOAL } from '../.github/hatirlat/gonder.mjs';
const now = new Date('2026-11-26T16:47:00Z'), { today, hour } = trNow(now);
assert.equal(hour, 19, 'Türkiye saati 19');
const st = o => JSON.stringify({ rem: 1, day: today, dayXp: 0, last: today - 1, streak: 5, freeze: true, wrong: [], ...o });
const sub = JSON.stringify({ endpoint: 'https://push.example/1', keys: { p256dh: 'a', auth: 'b' } });
const docs = [
  { id: 'seri', s: st({ day: today - 1, dayXp: 40 }), p: sub },            // dün çalıştı, bugün yok: seri uyarısı
  { id: 'tamam', s: st({ dayXp: GOAL, last: today }), p: sub },            // hedef tamam: gönderme
  { id: 'kapali', s: st({ rem: 0 }), p: sub },                              // hatırlatıcı kapalı
  { id: 'abonesiz', s: st({}), p: '' },                                     // abonelik yok
  { id: 'bugun', s: st({ day: today - 1 }), p: sub, ps: today },           // bugün zaten gönderildi
  { id: 'iki', s: st({ rem: 2, day: today - 1 }), p: sub, ps: today - 1 }, // 2 günde bir: dün gönderildi
  { id: 'yari', s: st({ dayXp: 12, last: today }), p: sub },               // hedefe 18 XP kaldı
  { id: 'gitti', s: st({ day: today - 1 }), p: sub },                      // abonelik silinmiş (410)
  { id: 'bozuk', s: '{', p: sub }
];
const sent = [], upd = {};
const out = await run({ docs, now, rnd: () => 0,
  send: async (s, payload) => { const b = JSON.parse(payload).body; if (sent.length === 2) { const e = new Error('gone'); e.statusCode = 410; throw e; } sent.push(b); },
  update: async (id, f) => { upd[id] = f; } });
assert.match(sent[0], /5 günlük serin var/);
assert.match(sent[1], /Hedefe 18 XP kaldı/);
assert.deepEqual(upd, { seri: { ps: today }, yari: { ps: today }, gitti: { p: '' } });
assert.deepEqual(out, { sent: 2, skip: 6, gone: 1, fail: 0 });
// Gece 23'te gönderilmez
assert.equal((await run({ docs: [docs[0]], now: new Date('2026-11-26T20:30:00Z'), send: async () => { throw new Error('x'); }, update: async () => {} })).sent, 0);
console.log('Hepsi geçti');
