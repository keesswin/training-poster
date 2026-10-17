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
const context = await browser.newContext({ viewport: { width: 1360, height: 2000 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
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

  await step('text fields start empty with faded example placeholders', async () => {
    for (const [id, ph] of [['headline', 'e.g. Career Awareness Program'], ['institution', 'e.g. GHSS Kuruchi'], ['location', 'e.g. Coimbatore']]) {
      assert.equal(await T(id).inputValue(), '', id);
      assert.equal(await T(id).getAttribute('placeholder'), ph);
    }
    assert.ok(parseFloat(await T('institution').evaluate((el) => getComputedStyle(el, '::placeholder').opacity)) < 0.7);
  });

  await step('date defaults to today, is adjustable, and Today resets it', async () => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    assert.equal(await T('date').inputValue(), iso);
    await T('date').fill('2025-01-02');
    assert.ok((await T('message').inputValue()).includes('2 Jan 2025'));
    await T('date-today').click();
    assert.equal(await T('date').inputValue(), iso);
  });

  await step('uploads Leaders Desk + institution logos (PNG and SVG)', async () => {
    await T('brand-logo-input').setInputFiles(fx('leadersdesk-logo.png'));
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
    assert.equal(await page.locator('[data-testid=photo-item]').nth(3).getByTestId('quality-badge').count(), 1); // a 320px photo is too small even for a side slot at high quality
    await page.locator('[data-testid=photo-item]').nth(3).getByTestId('make-hero').click(); // but too small for the big hero slot
    assert.equal(await page.locator('[data-testid=photo-item]').nth(3).getByTestId('quality-badge').textContent(), 'LOW RES');
    assert.equal(await page.locator('[data-testid=photo-item]').nth(0).getByTestId('quality-badge').count(), 0); // the 4000px photo is fine
    await page.locator('[data-testid=photo-item]').nth(3).locator('.thumbbtn').click();
    assert.ok((await T('quality-note').textContent()).includes('WhatsApp'));
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
    await T('institution').fill('St. Mary’s Higher Secondary School');
    await T('location').fill('Chennai, Tamil Nadu');
    await T('audience').fill('Grade 10');
    await T('date').fill('2026-10-12');
    await T('students').fill('120');
    await settle();
  });

  await step('students: digits only, shows in the message', async () => {
    await T('students').fill('');
    await T('students').pressSequentially('a1b2');
    assert.equal(await T('students').inputValue(), '12');
    await T('students').fill('120');
    assert.ok((await T('message').inputValue()).includes('120 students'));
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
    await page.locator('summary', { hasText: 'Style' }).click();
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

  await step('headline is remembered, offered in a dropdown, survives reload, can be forgotten', async () => {
    await T('headline').fill('Skill Development Workshop');
    await T('institution').focus(); // blur saves it
    await T('headline').fill('Career Awareness Program');
    await T('institution').focus();
    const opts = await page.locator('[data-testid=saved-headlines] option').allTextContents();
    assert.ok(opts.some((o) => o === 'Skill Development Workshop') && opts.some((o) => o === 'Career Awareness Program'), opts.join('|'));
    await T('saved-headlines').selectOption({ label: 'Skill Development Workshop' });
    assert.equal(await T('headline').inputValue(), 'Skill Development Workshop');
    const p2 = await context.newPage(); // a fresh load in the same browser profile
    await p2.goto(url);
    await p2.getByTestId('poster-canvas').waitFor();
    const after = await p2.locator('[data-testid=saved-headlines] option').allTextContents();
    assert.ok(after.includes('Skill Development Workshop'), 'persisted: ' + after.join('|'));
    // brand logo uploaded earlier is restored too
    await p2.waitForSelector('.logo-prev img');
    await p2.close();
    // city + audience + institution are remembered the same way
    await T('location').fill('Coimbatore');
    await T('audience').fill('Grade 9');
    await T('institution').fill('GHSS Kuruchi');
    await T('headline').focus();
    const p3 = await context.newPage();
    await p3.goto(url);
    await p3.getByTestId('poster-canvas').waitFor();
    for (const [id, v] of [['saved-cities', 'Coimbatore'], ['saved-audiences', 'Grade 9'], ['saved-institutions', 'GHSS Kuruchi']]) {
      assert.ok((await p3.locator(`[data-testid=${id}] option`).allTextContents()).includes(v), id);
    }
    await p3.getByTestId('saved-cities').selectOption({ label: 'Coimbatore' });
    assert.equal(await p3.getByTestId('location').inputValue(), 'Coimbatore');
    await p3.getByTestId('forget-cities').click();
    assert.ok(!(await p3.locator('[data-testid=saved-cities] option').allTextContents()).includes('Coimbatore'));
    await p3.close();
    await T('headline').fill('Skill Development Workshop');
    await T('forget-headlines').click();
    assert.ok(!(await page.locator('[data-testid=saved-headlines] option').allTextContents()).includes('Skill Development Workshop'));
  });

  await step('program description presets fill the box and feed the message', async () => {
    await T('institution').fill('St. Mary’s School');
    await T('audience').fill('Grade 10');
    await T('description-preset').selectOption({ label: 'Leadership program' });
    assert.ok((await T('description').inputValue()).includes('{audience}'));
    const msg = await T('message').inputValue();
    assert.ok(msg.includes('for Grade 10.') && !msg.includes('{'), msg);
  });

  await step('copy message puts the text on the clipboard; manual edits stick; reset restores auto', async () => {
    await T('copy-message').click();
    await page.waitForSelector('.notice.ok');
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await T('message').inputValue());
    await T('message').fill('custom text');
    await T('institution').fill('Changed School');
    assert.equal(await T('message').inputValue(), 'custom text');
    await T('reset-message').click();
    assert.ok((await T('message').inputValue()).includes('Changed School'));
    assert.ok((await T('wa-link').getAttribute('href')).startsWith('https://wa.me/?text='));
  });

  await step('share falls back to copy + saved poster where the share sheet is unavailable', async () => {
    await dismissAll();
    assert.equal(await page.getByTestId('attach-originals').count(), 0); // desktop has no share sheet, so no originals option
    const f = await dl('share', 'share-fallback.png');
    assert.deepEqual(pngSize(f.buf), { w: 2160, h: 2700 }); // shares the high-quality default
    assert.match(f.name, /^CHANGED-SCHOOL-\d{4}-\d{2}-\d{2}\.png$/);
    await page.waitForSelector('.notice.ok');
    // the caption is on the clipboard even though the share dialog is skipped on desktop
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await T('message').inputValue());
    assert.ok((await page.locator('.notice.ok').first().textContent()).includes('paste the message'));
  });

  await step('phone: share sheet gets poster (+ originals) and caption, and the caption is also copied', async () => {
    const mctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await mctx.addInitScript(() => {
      window.__shared = null;
      navigator.canShare = () => true;
      navigator.share = async (d) => { window.__shared = { names: d.files.map((f) => f.name), types: d.files.map((f) => f.type), text: d.text }; };
    });
    const mp = await mctx.newPage();
    await mp.goto(url);
    await mp.getByTestId('poster-canvas').waitFor();
    await mp.getByTestId('institution').fill('GHSS Kuruchi');
    await mp.getByTestId('date').fill('2026-10-16');
    await mp.getByTestId('photo-input').setInputFiles([fx('photo1-landscape.jpg'), fx('photo2-portrait.jpg')]);
    await mp.waitForFunction(() => document.querySelectorAll('[data-testid=photo-item]').length === 2);
    await mp.getByTestId('share').click();
    await mp.waitForFunction(() => window.__shared);
    let sh = await mp.evaluate(() => window.__shared);
    assert.deepEqual(sh.names, ['GHSS-KURUCHI-2026-10-16.png']);
    assert.ok(sh.text.includes('GHSS Kuruchi') && sh.text.includes('16 Oct 2026'), sh.text);
    assert.equal(await mp.evaluate(() => navigator.clipboard.readText()), sh.text);
    await mp.waitForSelector('.notice.ok');
    // originals option exists on phones
    await mp.evaluate(() => { window.__shared = null; });
    await mp.getByTestId('attach-originals').check();
    await mp.getByTestId('share').click();
    await mp.waitForFunction(() => window.__shared);
    sh = await mp.evaluate(() => window.__shared);
    assert.equal(sh.names.length, 3);
    assert.equal(sh.names[0], 'GHSS-KURUCHI-2026-10-16.png');
    // the phone preview is drawn far above screen resolution, so pinch-zooming shows real detail
    const cw = await mp.getByTestId('poster-canvas').evaluate((c) => c.width);
    const cssw = await mp.getByTestId('poster-canvas').evaluate((c) => c.getBoundingClientRect().width);
    assert.ok(cw >= Math.min(2160, cssw * 2 * 2) - 2, `preview canvas ${cw}px for ${cssw} css px`);
    // full-size viewer shows the real exported file
    await mp.getByTestId('full-view').click();
    await mp.waitForSelector('[data-testid=full-view-img]');
    await mp.waitForFunction(() => document.querySelector('[data-testid=full-view-img]').naturalWidth > 0);
    assert.equal(await mp.getByTestId('full-view-img').evaluate((i) => i.naturalWidth), 2160);
    await mp.getByTestId('full-view-zoom').click();
    assert.ok(await mp.getByTestId('full-view-img').evaluate((i) => i.classList.contains('actual')));
    await mp.screenshot({ path: join(out, '07-phone-fullview.png') });
    await mp.getByTestId('full-view-close').click();
    assert.equal(await mp.getByTestId('full-view-dialog').count(), 0);
    await mctx.close();
  });

  await step('description shows on the poster (toggle) and font style changes the artwork', async () => {
    await T('description').fill('AN INTERACTIVE SESSION ON CAREERS.');
    await settle();
    await T('show-description').check();
    const withDesc = await T('poster-canvas').screenshot();
    await T('show-description').uncheck();
    await settle();
    const noDesc = await T('poster-canvas').screenshot();
    assert.notDeepEqual(withDesc, noDesc);
    await T('show-description').check();
    await T('description-preset').selectOption({ label: 'Career awareness session' });
    await settle();
    await shot('06-grotesk');
    const grotesk = await T('poster-canvas').screenshot();
    for (const f of ['mono', 'classic']) {
      await T('fontset').selectOption(f);
      await settle();
      await shot('06-font-' + f);
      assert.notDeepEqual(grotesk, await T('poster-canvas').screenshot());
    }
    await T('fontset').selectOption('grotesk');
    await settle();
  });

  await step('brand switch changes palette and keeps a logo per brand', async () => {
    const before = await T('poster-canvas').screenshot();
    await T('brand-foundation').click();
    assert.equal((await T('color-navy').inputValue()).toLowerCase(), '#832840');
    assert.ok((await T('message').inputValue()).trim().endsWith('– Leaders Foundation'));
    await settle();
    await shot('03b-foundation');
    assert.notDeepEqual(before, await T('poster-canvas').screenshot());
    assert.equal(await page.locator('.logo-prev img').count(), 2); // Foundation's bundled default + institution logo
    await T('brand-desk').click();
    assert.equal((await T('color-navy').inputValue()).toLowerCase(), '#084a91');
    assert.equal(await page.locator('.logo-prev img').count(), 2);
  });

  const templates = ['hero-editorial', 'photo-story', 'event-highlights'];
  await step('all templates export exactly 1080×1350 PNGs with 6 photos (Instagram size)', async () => {
    await T('preset').selectOption('instagram-portrait');
    for (const t of templates) {
      await T('tpl-' + t).click();
      await settle();
      await shot(`04-preview-${t}`);
      const f = await dl('export', `export-${t}.png`);
      assert.deepEqual(pngSize(f.buf), { w: 1080, h: 1350 }, t);
      assert.ok(f.buf.length > 100_000, 'png is not trivially small');
      assert.match(f.name, /^CHANGED-SCHOOL-\d{4}-\d{2}-\d{2}-1080PX\.png$/, f.name);
      assert.ok((await page.locator('.notice.ok').count()) > 0);
    }
  });

  await step('high-quality default exports 2160×2700 and extra large exports 3240×4050', async () => {
    await T('preset').selectOption('hd');
    const f = await dl('export-top', 'export-2x.png');
    assert.deepEqual(pngSize(f.buf), { w: 2160, h: 2700 });
    assert.match(f.name, /^CHANGED-SCHOOL-\d{4}-\d{2}-\d{2}\.png$/);
    await T('preset').selectOption('xl');
    const x = await dl('export', 'export-3x.png');
    assert.deepEqual(pngSize(x.buf), { w: 3240, h: 4050 });
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
    assert.equal(await T('preset').inputValue(), 'hd'); // high quality is the default
    const f = await dl('export', 'export-empty.png');
    assert.deepEqual(pngSize(f.buf), { w: 2160, h: 2700 });
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
