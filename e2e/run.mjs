// End-to-end test: upload -> edit -> reorder/hero/crop -> templates -> export, in real Chromium.
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fx = (f) => join(root, 'e2e/fixtures', f);
const out = join(root, 'e2e/out');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
if (!existsSync(fx('photo1-landscape.jpg'))) execSync('python3 e2e/make_fixtures.py', { cwd: root, stdio: 'inherit' });

execSync('npm run build', { cwd: root, stdio: 'inherit' });
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'ignore' });
const url = 'http://localhost:4173/';
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(url)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 200));
}

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
let passed = 0;
const step = async (name, fn) => { await fn(); passed++; console.log('  ✓', name); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const T = (id) => page.getByTestId(id);
const shot = (name) => T('poster-wrap').screenshot({ path: join(out, name + '.png') });
const settle = () => page.waitForTimeout(250);
const names = () => page.locator('[data-testid=photo-item] .name').allTextContents();
const dismissAll = async () => { while ((await page.locator('.notice button').count()) > 0) await page.locator('.notice button').first().click(); };
const dl = async (testid, file) => {
  const [d] = await Promise.all([page.waitForEvent('download'), T(testid).click()]);
  const path = join(out, file);
  await d.saveAs(path);
  return { path, buf: readFileSync(path), name: d.suggestedFilename() };
};

try {
  await page.goto(url);
  await T('poster-canvas').waitFor();

  await step('empty state renders without photos', async () => { await settle(); await shot('00-empty'); });

  await step('uploads Leaders Desk + institution logos (PNG and SVG)', async () => {
    await T('ld-logo-input').setInputFiles(fx('leadersdesk-logo.png'));
    await T('inst-logo-input').setInputFiles(fx('school-logo.png'));
    await page.waitForSelector('.logo-prev img >> nth=1');
    assert.equal(await page.locator('.logo-prev img').count(), 2);
    await T('inst-logo-input').setInputFiles(fx('school-logo.svg'));
    await settle();
    assert.equal(await page.locator('.notice.error').count(), 0);
  });

  await step('rejects invalid files gracefully (txt, corrupt jpg, pdf)', async () => {
    await T('photo-input').setInputFiles([fx('notes.txt'), fx('corrupt.jpg'), fx('doc.pdf')]);
    await page.waitForSelector('.notice.error');
    await settle();
    assert.equal(await page.locator('.notice.error').count(), 3);
    assert.equal((await names()).length, 0);
    await dismissAll();
  });

  await step('rejects an SVG used as a photo', async () => {
    await T('photo-input').setInputFiles(fx('school-logo.svg'));
    await page.waitForSelector('.notice.error');
    assert.equal((await names()).length, 0);
    await page.locator('.notice button').first().click();
  });

  await step('uploads photos; warns on tiny image; remove works', async () => {
    await T('photo-input').setInputFiles([fx('photo1-landscape.jpg'), fx('photo2-portrait.jpg'), fx('photo3-wide.jpg')]);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=photo-item]').length === 3);
    await T('photo-input').setInputFiles(fx('tiny.jpg'));
    await page.waitForSelector('.notice.warn');
    assert.equal((await names()).length, 4);
    await page.locator('[data-testid=photo-item]').nth(3).getByTestId('remove-photo').click();
    assert.equal((await names()).length, 3);
    await dismissAll();
  });

  await step('1 photo and 2 photos render in every template', async () => {
    // down to a single photo
    await page.locator('[data-testid=photo-item]').nth(2).getByTestId('remove-photo').click();
    await page.locator('[data-testid=photo-item]').nth(1).getByTestId('remove-photo').click();
    assert.equal((await names()).length, 1);
    for (const t of ['hero-editorial', 'photo-story', 'event-highlights']) { await T('tpl-' + t).click(); await settle(); await shot(`01-one-photo-${t}`); }
    await T('photo-input').setInputFiles([fx('photo2-portrait.jpg')]);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=photo-item]').length === 2);
    for (const t of ['hero-editorial', 'photo-story', 'event-highlights']) { await T('tpl-' + t).click(); await settle(); await shot(`02-two-photos-${t}`); }
    await T('tpl-hero-editorial').click();
  });

  await step('enforces the 6-photo limit with a warning', async () => {
    await T('photo-input').setInputFiles([fx('photo3-wide.jpg'), fx('photo4-square.png'), fx('photo5-landscape.webp'), fx('photo6-landscape.jpg'), fx('photo7-extra.jpg')]);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=photo-item]').length === 6);
    await page.waitForSelector('.notice.warn');
    assert.equal((await names()).length, 6);
    assert.ok(await T('add-photos').isDisabled());
    assert.ok(/skipped/.test(await page.locator('.notice.warn').first().textContent()));
    await dismissAll();
  });

  await step('reorders photos with buttons and by drag-and-drop', async () => {
    const before = await names();
    await page.locator('[data-testid=photo-item]').nth(2).getByTestId('move-up').click();
    const after = await names();
    assert.deepEqual([after[1], after[2]], [before[2], before[1]]);
    await page.locator('[data-testid=photo-item]').nth(0).dragTo(page.locator('[data-testid=photo-item]').nth(4));
    const dragged = await names();
    assert.equal(dragged[4], after[0]);
  });

  await step('selects a different hero photo', async () => {
    const item = page.locator('[data-testid=photo-item]').nth(3);
    const heroName = await item.locator('.name').textContent();
    await item.getByTestId('make-hero').click();
    assert.equal(await page.locator('[data-testid=photo-item][data-hero=true] .name').textContent(), heroName);
    assert.equal(await page.locator('[data-testid=photo-item][data-hero=true]').count(), 1);
  });

  await step('edits headline, emphasis, footer text, optional detail', async () => {
    await T('headline').fill('Career Awareness Program');
    await T('emphasis').fill('Career');
    await T('institution').fill('St. Mary’s Higher Secondary School');
    await T('location').fill('Chennai, Tamil Nadu');
    await T('detail').fill('Grade 10 · 12 Oct 2026');
    await settle();
  });

  await step('crop: zoom + sliders + canvas drag change the crop', async () => {
    await page.locator('[data-testid=photo-item] .thumbbtn').nth(1).click();
    const before = await T('poster-canvas').screenshot();
    await T('zoom').fill('2.2');
    await T('pan-x').fill('0.1');
    await settle();
    const zoomed = await T('poster-canvas').screenshot();
    assert.notDeepEqual(before, zoomed);
    // drag the hero image on the poster itself
    const box = await T('poster-wrap').boundingBox();
    await page.locator('[data-testid=photo-item][data-hero=true] .thumbbtn').click();
    await T('zoom').fill('2');
    const fxBefore = await T('pan-x').inputValue();
    const hero = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
    await page.mouse.move(hero.x, hero.y);
    await page.mouse.down();
    await page.mouse.move(hero.x + 80, hero.y + 20, { steps: 6 });
    await page.mouse.up();
    assert.notEqual(await T('pan-x').inputValue(), fxBefore);
    await T('zoom').fill('1.4');
    await settle();
  });

  await step('brand colours + pattern controls update the preview', async () => {
    await page.locator('summary', { hasText: 'Brand' }).click();
    const base = await T('poster-canvas').screenshot();
    await T('pattern').fill('0');
    await settle();
    const noPattern = await T('poster-canvas').screenshot();
    assert.notDeepEqual(base, noPattern);
    await T('pattern').fill('100');
    await T('color-orange').fill('#00a389');
    await settle();
    await shot('03-recolored-max-pattern');
    await T('color-orange').fill('#f07b00');
    await T('pattern').fill('60');
    await settle();
  });

  const templates = ['hero-editorial', 'photo-story', 'event-highlights'];
  await step('all templates export exactly 1080×1350 PNGs with 6 photos', async () => {
    for (const t of templates) {
      await T('tpl-' + t).click();
      await settle();
      await shot(`04-preview-${t}`);
      const f = await dl('export', `export-${t}.png`);
      assert.deepEqual(pngSize(f.buf), { w: 1080, h: 1350 }, t);
      assert.ok(f.buf.length > 100_000, 'png is not trivially small');
      assert.equal(f.name, 'leaders-desk-poster-1080x1350.png');
      assert.ok((await page.locator('.notice.ok').count()) > 0);
    }
  });

  await step('@2x preset exports 2160×2700', async () => {
    await T('preset').selectOption('instagram-portrait-2x');
    const f = await dl('export-top', 'export-2x.png');
    assert.deepEqual(pngSize(f.buf), { w: 2160, h: 2700 });
    await T('preset').selectOption('instagram-portrait');
  });

  await step('exports with 3,4,5 photos for the gallery layouts', async () => {
    for (let n = 5; n >= 2; n--) {
      await page.locator('[data-testid=photo-item]').last().getByTestId('remove-photo').click();
      if (n > 5 || n < 2) continue;
      for (const t of ['hero-editorial', 'event-highlights', 'photo-story']) {
        await T('tpl-' + t).click();
        await settle();
        const f = await dl('export', `export-${n}photos-${t}.png`);
        assert.deepEqual(pngSize(f.buf), { w: 1080, h: 1350 });
      }
    }
  });

  await step('export without logo/photos still works', async () => {
    await page.reload();
    await T('poster-canvas').waitFor();
    const f = await dl('export', 'export-empty.png');
    assert.deepEqual(pngSize(f.buf), { w: 1080, h: 1350 });
  });

  await step('mobile layout: no horizontal scroll, preview fits', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(sw <= cw, `horizontal overflow ${sw} > ${cw}`);
    await page.screenshot({ path: join(out, '05-mobile.png'), fullPage: false });
  });

  assert.deepEqual(errors, [], 'no console errors');
  console.log(`\nE2E OK — ${passed} steps passed. Artifacts: e2e/out`);
} catch (e) {
  await page.screenshot({ path: join(out, 'FAILURE.png') }).catch(() => {});
  console.error('\nE2E FAILED:', e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
