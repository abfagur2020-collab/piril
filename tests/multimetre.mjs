// Sanal multimetre: arıza sorusunda ölçüler gizli başlar, ölçünce görünür, Seç ile cevaplanır.
// Çalıştır: node tests/multimetre.mjs [ekran-görüntüsü-klasörü]
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright'); // genel kurulum NODE_PATH ile bulunur

const url = pathToFileURL(fileURLToPath(new URL('../index.html', import.meta.url))).href;
const shots = process.argv[2];
const browser = await chromium.launch();
const errors = [];

async function open(scheme) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.emulateMedia({ colorScheme: scheme });
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  return page;
}
// Ölçülü ve ölçüsüz arıza soruları, sayfadaki veriden.
const pickIds = page => page.evaluate(() => {
  const ar = Object.entries(QUESTIONS).filter(([, q]) => q.t === 'ariza'), has = q => q.c.some(e => e[6] && reading(e)), hasN = q => nodes(q).length > 0;
  return { meas: ar.filter(([, q]) => has(q)).map(([k]) => k), node: ar.filter(([, q]) => hasN(q)).map(([k]) => k), plain: ar.filter(([, q]) => !has(q) && !hasN(q)).map(([k]) => k) };
});
const go = (page, id) => page.evaluate(id => start([id], id.split('-').slice(0, 2).join('-')), id);
const info = (page, id) => page.evaluate(id => { const q = QUESTIONS[id]; return { a: q.a, r: Object.fromEntries(q.c.filter(e => e[6] && reading(e)).map(e => [e[6], reading(e)])) }; }, id);
const part = (page, id) => page.locator(`.part[data-id="${id}"]`);

let shot = false;
try {
  const page = await open('light');
  const { meas, node, plain } = await pickIds(page);
  console.log(`ölçülü arıza: ${meas.length}, düğüm ölçülü: ${node.length}, ölçüsüz: ${plain.length}`);
  assert.equal(node.length, 5);
  assert.ok(meas.length > 0);

  for (const id of meas) {
    await go(page, id);
    const { a, r } = await info(page, id), ids = Object.keys(r);
    // Başta: Ölç seçili, ölçüler gizli (ne çizimde ne ekran okuyucu etiketinde).
    assert.equal(await page.locator('.seg button').count(), 2);
    assert.equal(await page.locator('.seg button').first().getAttribute('aria-pressed'), 'true');
    for (const p of ids) {
      assert.equal(await part(page, p).locator('.me').textContent(), '?', `${id} ${p} gizli değil`);
      assert.ok(!(await part(page, p).getAttribute('aria-label')).includes('ölçülen'), `${id} ${p} etiketi ölçüyü söylüyor`);
    }
    // Dokunarak ölç: ölçü çizimde ve göstergede görünür, cevap seçilmez.
    const m1 = ids.find(p => p !== a) || ids[0];
    await part(page, m1).click();
    assert.equal(await part(page, m1).locator('.me').textContent(), r[m1]);
    assert.match(await page.locator('.dmm').textContent(), new RegExp(`${r[m1]}.*1 ölçüm`));
    assert.equal(await part(page, m1).getAttribute('aria-checked'), 'false');
    assert.ok(await page.locator('#ok').isDisabled());
    if (shots && !shot && ids.length >= 3) { // üç ölçülü ilk soru: biri ölçülmüş, ikisi gizli
      shot = true;
      await page.screenshot({ path: `${shots}/multimetre-light.png` });
      const dark = await open('dark');
      await go(dark, id);
      await part(dark, m1).click();
      await dark.screenshot({ path: `${shots}/multimetre-dark.png` });
      await dark.close();
    }
    // Klavyeyle ölç (Enter) ve sayaç.
    const m2 = ids.find(p => p !== m1);
    if (m2) {
      await part(page, m2).focus(); await page.keyboard.press('Enter');
      assert.equal(await part(page, m2).locator('.me').textContent(), r[m2]);
      assert.match(await page.locator('.dmm').textContent(), /2 ölçüm/);
    }
    // Seç moduna geç, doğru elemanı seç, kontrol et.
    await page.locator('.seg button', { hasText: 'Seç' }).click();
    assert.equal(await page.locator('.seg button').nth(1).getAttribute('aria-pressed'), 'true');
    await part(page, a).click();
    assert.equal(await part(page, a).getAttribute('aria-checked'), 'true');
    await page.locator('#ok').click();
    assert.match(await page.locator('.foot h2').textContent(), /^Doğru/, `${id} doğru sayılmadı`);
    for (const p of ids) assert.equal(await part(page, p).locator('.me').textContent(), r[p], `${id} ${p} cevaptan sonra görünmüyor`);
    console.log(`ok  ${id} (${a})`);
  }

  // Düğüm ölçüleri: değer "?" başlar, ölçüm noktası düğmesiyle açılır; elemana dokunmak seçer.
  for (const id of node) {
    await go(page, id);
    const { a } = await info(page, id), nd = await page.evaluate(id => nodes(QUESTIONS[id]).map(e => [nodeName(e), nodeVal(e)]), id);
    const me = page.locator('.ckt .node .me');
    assert.equal(await me.count(), nd.length);
    for (let i = 0; i < nd.length; i++) {
      assert.ok((await me.nth(i).textContent()).endsWith('?'), `${id} ${nd[i][0]} gizli başlamadı`);
      assert.ok(!(await me.nth(i).textContent()).includes(nd[i][1]));
    }
    for (let i = 0; i < nd.length; i++) {
      await page.locator(`.prb button[data-n="${i}"]`).click();
      assert.ok((await me.nth(i).textContent()).endsWith(nd[i][1]), `${id} ${nd[i][0]} açılmadı`);
      assert.match(await page.locator('.dmm').textContent(), new RegExp(`${nd[i][1]}.*${i + 1} ölçüm`));
    }
    await page.locator('.prb button[data-n="0"]').click(); // aynı noktayı yeniden ölçmek sayacı artırmaz
    assert.match(await page.locator('.dmm').textContent(), new RegExp(`${nd.length} ölçüm`));
    await part(page, a).click();
    await page.locator('#ok').click();
    assert.match(await page.locator('.foot h2').textContent(), /^Doğru/, `${id} doğru sayılmadı`);
    console.log(`ok  ${id} (${a}, düğüm: ${nd.map(x => x.join(' = ')).join(', ')})`);
  }

  // Ölçüsüz arıza soruları eskisi gibi: mod düğmesi ve gösterge yok, dokununca seçilir.
  for (const id of plain) {
    await go(page, id);
    const { a } = await info(page, id);
    assert.equal(await page.locator('.seg, .dmm').count(), 0);
    await part(page, a).click();
    assert.ok(await page.locator('#ok').isEnabled());
    await page.locator('#ok').click();
    assert.match(await page.locator('.foot h2').textContent(), /^Doğru/, `${id} doğru sayılmadı`);
    console.log(`ok  ${id} (${a}, ölçüsüz)`);
  }
  assert.deepEqual(errors, [], 'konsol hatası');
  console.log('GEÇTİ');
} catch (e) {
  console.error('BAŞARISIZ:', e.message, errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
