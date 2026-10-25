// The live light on the World page, in Chrome (the e2e tier: it launches a browser, and passes saying nothing when none is
// installed). Machine gates only: what the pixels and the page's probe say, never how it looks.
//   · actor shadows over the baked sun: an actor's shadow darkens a floor the sun lights and leaves a floor the bake
//     already shadows alone; a world that bakes no sun darkens both by the cast's alpha;
//   · the hour's map: drawn once at load, never per frame, and again once when the hour changes; it shadows the floor;
//   · occlusion: one prepass a frame with creases and occlusion both on; contact darkens the floor at a box's foot.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { emitThreeWorld } from './scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from './chromium.js';

const W = 320, H = 240;
const half = (x0, x1, extra = {}) => ({ corners: [[x0, -6, 0], [x1, -6, 0], [x1, 6, 0], [x0, 6, 0]], fill: '#c0c0c0', ...extra });
// a box of faces (a static caster), from its min to its max corner
const boxFaces = ([x0, y0, z0], [x1, y1, z1], fill = '#c0c0c0') => [
  [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
  [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]],
  [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]],
].map((corners) => ({ corners, fill }));
const SUN = [0.7071, 0, 0.7071];   // toward the sun: up and to +x, so a shadow falls to −x of its caster
const CAM = { pos: [0, -14, 16], target: [0, 0, 0], vfov: 50 };

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

async function open(payload) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, ...payload }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 30000 });
  return { page, errors };
}
// add floating boxes that move (actors: adopted into the actors' map), each the floor's grey
const addActors = (page, at) => page.evaluate((at) => {
  const { THREE, scene } = window.__mojCast.dbg;
  for (const p of at) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xc0c0c0 }));
    m.position.set(p[0], p[1], p[2]); scene.add(m); window.__mojCast.adopt(m);
  }
}, at);
// render a frame and read the canvas's luminance along a row through the floor (the floor's line y = 0, z = 0)
const frameRow = (page) => page.evaluate(({ CAM, W, H }) => {
  window.__mojCapture.frame(CAM);
  const cv = document.querySelector('canvas'), c2 = document.createElement('canvas');
  c2.width = cv.width; c2.height = cv.height;
  const g = c2.getContext('2d'); g.drawImage(cv, 0, 0);
  const d = g.getImageData(0, 0, c2.width, c2.height).data, sx = c2.width / W, sy = c2.height / H;
  // the floor's line y = 0 projects to the frame's middle row band: read the band a little below the centre
  const row = Math.round((H * 0.5) * sy), out = [];
  for (let x = 0; x < c2.width; x++) { const i = (row * c2.width + x) * 4; out.push((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255); }
  return out;
}, { CAM, W, H });
const stats = (v) => { const s = [...v].sort((a, b) => a - b); return { min: s[0], med: s[Math.floor(s.length / 2)] }; };

describe('live light in Chrome', () => {
  it('an actor\'s shadow darkens the lit floor and not the baked-shadowed one', async () => {
    if (!browser) return;
    // the left half lit by the bake (its sun share 0.7), the right half in the baked shadow (share 0)
    const { page, errors } = await open({ faces: [half(-24, 0, { sunShare: 0.7 }), half(0, 24, { sunShare: 0 })], shadows: { actors: true, toLight: SUN } });
    await addActors(page, [[-3.5, 0, 2.2], [6.5, 0, 2.2]]);
    const row = await frameRow(page);
    const n = row.length, left = row.slice(0, Math.floor(n / 2) - 2), right = row.slice(Math.floor(n / 2) + 2);
    const L = stats(left), R = stats(right);
    expect(L.min).toBeLessThan(L.med * 0.55);   // the shadow takes the lit floor down by its share
    expect(R.min).toBeGreaterThan(R.med * 0.9);   // the baked shadow is not darkened again
    expect(errors).toEqual([]);
    await page.close();
  }, 90000);

  it('a world that bakes no sun darkens by the cast\'s alpha', async () => {
    if (!browser) return;
    const { page, errors } = await open({ faces: [half(-24, 0), half(0, 24)], shadows: { actors: true, toLight: SUN, alpha: 0.5 } });
    await addActors(page, [[-3.5, 0, 2.2], [6.5, 0, 2.2]]);
    const row = await frameRow(page);
    const n = row.length, L = stats(row.slice(0, n / 2 - 2)), R = stats(row.slice(n / 2 + 2));
    for (const S of [L, R]) { expect(S.min).toBeLessThan(S.med * 0.75); expect(S.min).toBeGreaterThan(S.med * 0.3); }
    expect(errors).toEqual([]);
    await page.close();
  }, 90000);

  it('the hour\'s map is drawn once at load, never per frame, and once more when the hour changes', async () => {
    if (!browser) return;
    // a static block on the lit floor: only the hour's map can shadow the floor beside it (nothing is baked here)
    const { page, errors } = await open({ faces: [half(-24, 0, { sunShare: 0.7 }), half(0, 24, { sunShare: 0.7 }), ...boxFaces([-2, -1, 0], [-1, 1, 3])], shadows: { hour: true, toLight: SUN } });
    for (let i = 0; i < 5; i++) await frameRow(page);
    const a = await page.evaluate(() => ({ ...window.__mojLight }));
    expect(a.hourMaps).toBe(1);
    expect(a.hourDraws).toBe(1);
    expect(a.frames).toBeGreaterThanOrEqual(6);   // the capture's first render, then five frames
    const row = await frameRow(page), S = stats(row);
    expect(S.min).toBeLessThan(S.med * 0.55);   // the block's shadow on the floor
    await page.evaluate(() => window.__mojCast.hour([-0.7071, 0, 0.7071]));
    for (let i = 0; i < 4; i++) await frameRow(page);
    const b = await page.evaluate(() => ({ ...window.__mojLight }));
    expect(b.hourMaps).toBe(2);
    expect(b.hourDraws).toBe(2);
    expect(errors).toEqual([]);
    await page.close();
  }, 90000);

  it('a sun-baked stage compiles with the share on its welded, textured fills, both maps on', async () => {
    if (!browser) return;
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const M = { kind: 'stage', kit: 'island-plaza', reference: 'island-noon', dress: false, rooms: [{ id: 'a', x: 0, y: 0, w: 10, d: 10, h: 4 }], shadows: { actors: true, hour: true } };
    const { payload } = await resolveWorldScene({ manifest: M, title: 'plaza' });
    const { page, errors } = await open({ ...payload, walk: false });
    await frameRow(page);
    const p = await page.evaluate(() => {
      const { scene } = window.__mojCast.dbg; let shared = 0, patched = 0;
      scene.traverse((o) => { if (o.isMesh && o.geometry.getAttribute('aSun')) { shared++; if (o.material.defines && 'CS_SUN' in o.material.defines) patched++; } });
      return { shared, patched, ...window.__mojLight };
    });
    expect(p.shared).toBeGreaterThan(0);
    expect(p.patched).toBe(p.shared);
    expect(p.hourDraws).toBe(1);
    expect(errors).toEqual([]);
    await page.close();
  }, 120000);

  it('creases and occlusion draw one prepass a frame, and contact darkens the floor at a box\'s foot', async () => {
    if (!browser) return;
    const faces = [half(-24, 24), ...boxFaces([-1, -1, 0], [1, 1, 2])];
    const { page, errors } = await open({ faces, creases: true, occlusion: { strength: 1, reach: 0.8 } });
    for (let i = 0; i < 3; i++) await frameRow(page);
    const p = await page.evaluate(() => ({ ...window.__mojLight }));
    expect(p.prepasses).toBe(p.prepassCalls);   // one scene render into the prepass target a frame, for both
    expect(p.aoPasses).toBe(p.prepassCalls);
    const on = await frameRow(page);
    const off = await (async () => { await page.evaluate(() => window.__mojOcclusion.set(false)); return frameRow(page); })();
    // the floor beside the block's foot is darker with occlusion than without; far from it, the same
    const diff = on.map((v, i) => off[i] - v);
    expect(Math.max(...diff)).toBeGreaterThan(0.05);   // (0.098 in SwiftShader at strength 1, reach 0.8 m)
    expect(diff[2]).toBeLessThan(0.02);
    expect(errors).toEqual([]);
    await page.close();
  }, 90000);
});
