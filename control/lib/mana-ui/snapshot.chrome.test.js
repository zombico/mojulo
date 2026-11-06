// The transfer gate (the e2e tier: it launches a browser, and passes saying nothing when none is installed): what a
// headset's panel shows of a mana-ui view is what the screen shows. The view's DOM screenshot against its snapshot
// (snapshot.js) drawn into a canvas, pixel by pixel. Machine gate only: the pixels agree; how either looks is the eyes'.
//   · a settled screen in a theme that leans on every feature the sheet uses (a pseudo-element cursor, gradient
//     patterns, cut corners, ornaments, a moment's banner and passing numbers over the world)
//   · a frame mid-motion: an entrance and a moment's slam caught halfway (the browser runs its animations on the main
//     thread here, so its screenshot is of the same instant the snapshot bakes; on the compositor it can be a frame on)
//   · a crop: one box of the view alone, as a billboard draws it, is that box of the whole
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { manaUiPage, SAMPLE_STATE } from './index.js';
import { manaSnapshotSource } from './snapshot.js';
import { resolveChromium, launchChromium } from '../graph/scene/chromium.js';

const W = 960, H = 540, BG = '#3a5a40', ONE_PIXEL = 0.005;
const THEME = { from: 'console', corner: 'cut', focus: 'marker', ornaments: ['brackets', 'scanlines', 'stitch'] };
const SPEC = { screens: { menu: { use: 'battle-menu', props: { message: { bind: 'battle.message' }, turns: { bind: 'battle.turns' }, foes: { bind: 'battle.foes' }, commands: { bind: 'battle.commands' }, party: { bind: 'battle.party' } } } },
  hud: { use: 'hud', children: [{ use: 'damage-numbers', props: { pops: { bind: 'pops' } } }, { use: 'moment-banner', props: { moments: { bind: 'moments' } } }] } };

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: ['--disable-threaded-animation', '--disable-threaded-scrolling'] });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

async function open() {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: W, height: H });
  const html = manaUiPage(SPEC, { state: SAMPLE_STATE, open: 'menu', theme: THEME }).replace('background:#ececec', `background:${BG}`).replace('.log{', '.log{display:none;');
  await page.setContent(html.replace('</body>', `<script>window.SNAP = ${manaSnapshotSource()};</script></body>`), { waitUntil: 'load' });
  return { page, errors };
}
// the page held at this instant (every animation paused where it is), drawn once more so a screenshot is of it
const hold = (page) => page.evaluate(async () => { for (const a of document.getAnimations()) a.pause(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
// the snapshot of the view (or a box of it) drawn into a canvas over the page's ground, as a PNG data URL
const snapped = (page, crop = null, bare = false) => page.evaluate(async ({ crop, BG, bare }) => {
  // (bare: the sheet without the theme's rules over it, the gate's own control)
  const root = document.querySelector('.mana-root'), all = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
  const css = bare ? all.split('\n').filter((l) => !l.includes('--mana-panel:') && !l.includes('::after{content:"";position:absolute;inset:0')).join('\n') : all;
  const img = await SNAP.imageOf(SNAP.svgOf(root, css, crop ? { crop } : {}));
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.fillStyle = BG; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}, { crop, BG, bare });
// the share of pixels that differ past a small tolerance, between two PNGs of one size; a pixel is off only when
// nothing within one pixel of it in the other matches. What is left after that is the half pixel: a box centred by
// translate(-50%) on an odd size, which the screen's compositor snaps to the pixel and an image draws where layout put
// it, its edges anti-aliased (well under ONE_PIXEL of the frame). A missing ornament, a wrong theme, a frame from
// another instant or a box out of place is far past it.
const apart = (page, a, b) => page.evaluate(async ([a, b]) => {
  const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
  const [A, B] = await Promise.all([load(a), load(b)]);
  const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; const x = c.getContext('2d');
  x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
  x.clearRect(0, 0, c.width, c.height); x.drawImage(B, 0, 0); const db = x.getImageData(0, 0, c.width, c.height).data;
  const w = c.width, h = c.height, near = (i, j) => Math.abs(da[i] - db[j]) + Math.abs(da[i + 1] - db[j + 1]) + Math.abs(da[i + 2] - db[j + 2]) <= 48;
  let off = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (near(i, i)) continue;
    let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) ok = near(i, (Y * w + X) * 4); }
    if (!ok) off++;
  }
  return { off: off / (da.length / 4), same: A.width === B.width && A.height === B.height };
}, [a, b]);
const shot = async (page, clip) => `data:image/png;base64,${Buffer.from(await page.screenshot(clip ? { clip } : {})).toString('base64')}`;

describe('mana-ui: the transfer gate (a headset\'s panel shows what the screen shows)', () => {
  it('a settled screen: every feature of the sheet, the same pixels', async () => {
    if (!browser) return;
    const { page, errors } = await open();
    await new Promise((r) => setTimeout(r, 1500));
    await hold(page);
    const r = await apart(page, await shot(page), await snapped(page));
    expect(r.same).toBe(true);
    expect(r.off).toBeLessThan(ONE_PIXEL);
    // (the gate bites: the same view snapped without its theme is far past it)
    expect((await apart(page, await shot(page), await snapped(page, null, true))).off).toBeGreaterThan(ONE_PIXEL * 4);
    expect(errors).toEqual([]);
    await page.close();
  }, 60000);
  it('a frame mid-motion: the entrance and the moment caught halfway, the same pixels', async () => {
    if (!browser) return;
    const { page } = await open();
    await new Promise((r) => setTimeout(r, 70));
    await hold(page);
    // (something is mid-flight: the instant is worth the gate)
    expect(await page.evaluate(() => document.getAnimations().some((a) => a.effect && a.currentTime > 0 && a.currentTime < a.effect.getComputedTiming().endTime))).toBe(true);
    const r = await apart(page, await shot(page), await snapped(page));
    expect(r.off).toBeLessThan(ONE_PIXEL);
    await page.close();
  }, 60000);
  it('a crop: one box alone is that box of the whole', async () => {
    if (!browser) return;
    const { page } = await open();
    await new Promise((r) => setTimeout(r, 1500));
    await hold(page);
    const box = await page.evaluate(() => { const r = document.querySelector('.mana-anchor').getBoundingClientRect(); return { x: Math.floor(r.x), y: Math.floor(r.y), w: Math.ceil(r.width), h: Math.ceil(r.height) }; });
    const r = await apart(page, await shot(page, { x: box.x, y: box.y, width: box.w, height: box.h }), await snapped(page, box));
    expect(r.same).toBe(true);
    expect(r.off).toBeLessThan(ONE_PIXEL);
    await page.close();
  }, 60000);
});
