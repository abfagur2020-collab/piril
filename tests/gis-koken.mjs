// Canlı denetim (internet gerekir): Google, uygulamanın adresine giriş düğmesi veriyor mu?
// Google Cloud'da OAuth istemcisine "Yetkili JavaScript kaynağı" eklenmemişse düğme 403 döner ve iPhone'da giriş olmaz.
// Çalıştır: node tests/gis-koken.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const cid = /const GCID = '([^']+)'/.exec(html)[1];
const page = `<!doctype html><div id=b></div><script src="https://accounts.google.com/gsi/client" async onload="google.accounts.id.initialize({client_id:'${cid}',callback:()=>0});google.accounts.id.renderButton(document.getElementById('b'),{size:'large'})"></script>`;
const browser = await chromium.launch(), ctx = await browser.newContext();
let fail = 0;
for (const origin of ['https://abfagur2020-collab.github.io']) {
  await ctx.route(origin + '/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: page }));
  const p = await ctx.newPage(); let st = null;
  p.on('response', r => { if (r.url().includes('/gsi/button')) st = r.status(); });
  await p.goto(origin + '/piril/'); await p.waitForTimeout(6000);
  const good = st === 200; if (!good) fail++;
  console.log(`${good ? 'ok  ' : 'HATA'} ${origin} → Google düğmesi ${st ?? 'yanıt yok (internet?)'}${good ? '' : ' — Google Cloud > Kimlik bilgileri > Web client > Yetkili JavaScript kaynakları\'na ekle'}`);
}
await browser.close();
console.log(fail ? `${fail} hata` : 'Hepsi geçti'); process.exit(fail ? 1 : 0);
