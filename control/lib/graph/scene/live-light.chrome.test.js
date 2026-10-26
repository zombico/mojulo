// The live light on the World page, in Chrome (the e2e tier: it launches a browser, and passes saying nothing when none is
// installed). Machine gates only: what the pixels and the page's probe say, never how it looks.
//   · actor shadows over the baked sun: an actor's shadow darkens a floor the sun lights and leaves a floor the bake
//     already shadows alone; a world that bakes no sun darkens both by the cast's alpha;
//   · the hour's map: drawn once at load, never per frame, and again once when the hour changes; it shadows the floor;
//   · occlusion: one prepass a frame with creases and occlusion both on; contact darkens the floor at a box's foot.
//   · the defaults (live-light-defaults): the hour's map lays no moire on wide terrain under a low sun and keeps a
//     caster's shadow; the half tier's occlusion still darkens a box's foot; the pass budget per tier on a hero's level
//     (renders, shadow passes and draws a frame, map and target sizes: counts, never milliseconds).
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

// A STANDING FIGURE's shadow, measured on the floor: two legs and a torso (adopted actors) stand on a sun-lit floor, the
// focus at its feet as the controllable hands it over. The figure is drawn into the shadow map but not into the frame
// (its colour and depth writes off), so the floor under and behind it shows; the shadow is the floor's darkening against
// the same frame with the figure gone. Sampled on world lines, each point projected through the capture's own camera.
const FIG = { legs: [[-0.07, 0.05, 0.07, 0.19], [-0.07, -0.19, 0.07, -0.05]], legTop: 0.9, torso: [-0.12, -0.2, 0.12, 0.2, 0.9, 1.5] };
const FIG_CAM = { pos: [-0.6, -2.6, 3.0], target: [-0.6, 0, 0], vfov: 45 };
async function figureShadow({ focus }) {
  const FW = 640, FH = 480;
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: FW, height: FH });
  await page.setContent(emitThreeWorld({ viewBox: { width: FW, height: FH }, inline: true, capture: true, hud: false, faces: [half(-24, 24, { sunShare: 0.7 })], shadows: { actors: true, toLight: SUN } }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 30000 });
  const out = await page.evaluate(({ FIG, CAM, focus }) => {
    const { THREE, scene } = window.__mojCast.dbg;
    const fig = new THREE.Group(), box = (x0, y0, x1, y1, z0, z1) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.MeshBasicMaterial({ color: 0x808080 }));
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); fig.add(m);
    };
    for (const [x0, y0, x1, y1] of FIG.legs) box(x0, y0, x1, y1, 0, FIG.legTop);
    box(...FIG.torso);
    scene.add(fig); window.__mojCast.adopt(fig);
    fig.traverse((o) => { if (o.isMesh) { o.material.colorWrite = false; o.material.depthWrite = false; } });
    if (focus) window.__mojCast.focus(() => [0, 0, 0, 0]);
    const cv = document.querySelector('canvas'), c2 = document.createElement('canvas');
    c2.width = cv.width; c2.height = cv.height;
    const g = c2.getContext('2d');
    const cam = new THREE.PerspectiveCamera(CAM.vfov, cv.width / cv.height, 0.1, 100);
    cam.up.set(0, 0, 1); cam.position.set(...CAM.pos); cam.lookAt(...CAM.target); cam.updateMatrixWorld();
    const grab = () => { window.__mojCapture.frame(CAM); g.drawImage(cv, 0, 0); return g.getImageData(0, 0, c2.width, c2.height).data; };
    const on = grab(); fig.visible = false; const off = grab();
    // the floor's darkening at a world point: 1 − (with the figure) / (without it), on luminance
    const v = new THREE.Vector3(), Y = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const dark = (x, y) => {
      v.set(x, y, 0).project(cam);
      const px = Math.floor((v.x * 0.5 + 0.5) * c2.width), py = Math.floor((0.5 - v.y * 0.5) * c2.height), i = (py * c2.width + px) * 4;
      return 1 - Y(on, i) / Math.max(1, Y(off, i));
    };
    const line = (x0, y0, x1, y1, n) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; return [x, y, dark(x, y)]; });
    return { along: line(0.3, 0.12, -1.0, 0.12, 650), across: line(-0.4, -0.05, -0.4, 0.4, 225), half: window.__mojCast.light.shadow.camera.right };
  }, { FIG, CAM: FIG_CAM, focus });
  // the shadow's edge on the sun's side of the leg (the darkening's half-maximum, coming from the sun), against the
  // leg's own sun-side face at x = 0.07: the gap; across the leg's streak, the 10 %–90 % rise of its outer edge: the penumbra
  const dmax = Math.max(...out.along.map((p) => p[2]));
  const edge = out.along.find((p) => p[2] >= 0.5 * dmax);
  const gap = FIG.legs[0][2] - edge[0];
  const acr = out.across.filter((p) => p[1] >= 0.12), amax = Math.max(...acr.map((p) => p[2]));
  const y90 = acr.filter((p) => p[2] >= 0.9 * amax).pop()[1], y10 = acr.filter((p) => p[2] >= 0.1 * amax).pop()[1];
  await page.close();
  return { gap, penumbra: y10 - y90, dmax, half: out.half, errors };
}

describe('live light in Chrome', () => {
  it('a standing figure\'s shadow meets its foot and keeps a narrow edge: the box follows the focus from the first frame', async () => {
    if (!browser) return;
    const s = await figureShadow({ focus: true });
    expect(s.half).toBe(16);   // the box round the focus, at the default span, in the first frame asked
    expect(s.dmax).toBeGreaterThan(0.5);   // the leg's shadow takes the lit floor down by its share (0.7)
    // (in SwiftShader: a gap of -0.006 m, the edge 6 mm past the leg's face, and a 0.03 m penumbra; with no focus, the
    // FIT box over the stage, 0.05 and 0.11; before 1025, back faces cast and the floor under the foot was half lit)
    expect(Math.abs(s.gap)).toBeLessThan(0.05);
    expect(s.penumbra).toBeLessThan(0.06);
    expect(s.errors).toEqual([]);
  }, 90000);

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

  it('indoors an actor lays a soft contact blob under it, not a shadow off the outdoor sun, and none from high up', async () => {
    if (!browser) return;
    const FW = 640, FH = 480, page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({ width: FW, height: FH });
    // an interior (no baked sun, `sky.preset 'interior'`): the world's toLight would put a shadow 1.2 m to −x of a figure
    await page.setContent(emitThreeWorld({ viewBox: { width: FW, height: FH }, inline: true, capture: true, hud: false, faces: [half(-24, 24)], sky: { preset: 'interior' }, shadows: { actors: true, toLight: SUN } }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 30000 });
    const r = await page.evaluate(({ FIG, CAM }) => {
      const { THREE, scene } = window.__mojCast.dbg;
      const fig = new THREE.Group(), box = (x0, y0, x1, y1, z0, z1) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.MeshBasicMaterial({ color: 0x808080 }));
        m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); fig.add(m);
      };
      for (const [x0, y0, x1, y1] of FIG.legs) box(x0, y0, x1, y1, 0, FIG.legTop);
      box(...FIG.torso);
      box(-1.5, 0.8, -0.9, 1.4, 2.2, 2.8);   // a box hanging 2.2 m up: too high to touch the floor
      scene.add(fig); window.__mojCast.adopt(fig);
      fig.traverse((o) => { if (o.isMesh) { o.material.colorWrite = false; o.material.depthWrite = false; } });
      window.__mojCast.focus(() => [0, 0, 0, 0]);
      const cv = document.querySelector('canvas'), c2 = document.createElement('canvas');
      c2.width = cv.width; c2.height = cv.height;
      const g = c2.getContext('2d');
      const cam = new THREE.PerspectiveCamera(CAM.vfov, cv.width / cv.height, 0.1, 100);
      cam.up.set(0, 0, 1); cam.position.set(...CAM.pos); cam.lookAt(...CAM.target); cam.updateMatrixWorld();
      const grab = () => { window.__mojCapture.frame(CAM); g.drawImage(cv, 0, 0); return g.getImageData(0, 0, c2.width, c2.height).data; };
      const on = grab(); fig.visible = false; const off = grab();
      const v = new THREE.Vector3(), Y = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const dark = (x, y) => { v.set(x, y, 0).project(cam); const px = Math.floor((v.x * 0.5 + 0.5) * c2.width), py = Math.floor((0.5 - v.y * 0.5) * c2.height), i = (py * c2.width + px) * 4; return 1 - Y(on, i) / Math.max(1, Y(off, i)); };
      const peak = (x0, y0, x1, y1) => { let m = 0; for (let x = x0; x <= x1; x += 0.02) for (let y = y0; y <= y1; y += 0.02) m = Math.max(m, dark(x, y)); return m; };
      return { under: peak(-0.1, -0.1, 0.1, 0.1), rim: dark(0.55, 0), sunward: peak(-1.5, -0.25, -0.7, 0.25), hung: peak(-1.4, 0.9, -1.0, 1.3) };
    }, { FIG, CAM: FIG_CAM });
    // (in SwiftShader: 0.32 between the feet, the alpha's 0.38 at most; 0 half a metre out, sunward and under the box)
    expect(r.under).toBeGreaterThan(0.15);   // the blob under the figure, between its feet
    expect(r.rim).toBeLessThan(r.under / 3);   // soft: faded half a metre out
    expect(r.sunward).toBeLessThan(0.01);   // nothing where the outdoor sun would have thrown it
    expect(r.hung).toBeLessThan(0.01);   // nothing under what does not touch the floor
    expect(errors).toEqual([]);
    await page.close();
  }, 90000);

  it('a cutout card occludes by its opaque texels only: its transparent half adds no occlusion', async () => {
    if (!browser) return;
    // (the actors' channel only lends the page's THREE and scene: nothing here is adopted, so its map stays empty)
    const { page, errors } = await open({ faces: [half(-24, 24)], occlusion: { strength: 1, reach: 0.8 }, shadows: { actors: true } });
    const r = await page.evaluate(({ CAM }) => {
      const { THREE, scene } = window.__mojCast.dbg;
      // a standing card, x −2..2, 2 m high, at y = 0.3: its map transparent on the left half (x < 0), opaque on the right,
      // alpha-tested as the emitter draws a leaf card or a grass clump
      const tex = new THREE.DataTexture(new Uint8Array([200, 200, 200, 0, 200, 200, 200, 255]), 2, 1);
      tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
      const card = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }));
      card.rotation.x = Math.PI / 2; card.position.set(0, 0.3, 1); scene.add(card);
      const cv = document.querySelector('canvas'), c2 = document.createElement('canvas');
      c2.width = cv.width; c2.height = cv.height;
      const g = c2.getContext('2d');
      const cam = new THREE.PerspectiveCamera(CAM.vfov, cv.width / cv.height, 0.1, 100);
      cam.up.set(0, 0, 1); cam.position.set(...CAM.pos); cam.lookAt(...CAM.target); cam.updateMatrixWorld();
      const grab = () => { window.__mojCapture.frame(CAM); g.drawImage(cv, 0, 0); return g.getImageData(0, 0, c2.width, c2.height).data; };
      const on = grab(); card.visible = false; const off = grab();
      // the floor in front of the card's foot (y = 0.15), each half beyond the occlusion's reach of the other: the darkening
      // the card lays there
      const v = new THREE.Vector3(), Y = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const dark = (x) => { v.set(x, 0.15, 0).project(cam); const px = Math.floor((v.x * 0.5 + 0.5) * c2.width), py = Math.floor((0.5 - v.y * 0.5) * c2.height), i = (py * c2.width + px) * 4; return 1 - Y(on, i) / Math.max(1, Y(off, i)); };
      const span = (x0, x1) => { let m = 0; for (let x = x0; x <= x1; x += 0.05) m = Math.max(m, dark(x)); return m; };
      return { clear: span(-1.8, -1.0), opaque: span(1.0, 1.8) };
    }, { CAM });
    // (in SwiftShader: 0.17 at the opaque half's foot and 0 at the transparent half's; before 1025, 0.17 at both)
    expect(r.opaque).toBeGreaterThan(0.05);   // the opaque half is drawn into the prepass and occludes its foot
    expect(r.clear).toBeLessThan(0.005);   // the transparent half adds none
    expect(errors).toEqual([]);
    await page.close();
  }, 90000);

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

  // a 600 m terrain, rolling a metre or two (its own rises cast a little, honestly), its sun share 0.7; a walker's eye
  // looking far over it under a low sun. Every darkening the hour's map lays where nothing stands is the map shadowing
  // the ground with itself
  const TERRAIN = (() => {
    const N = 60, S = 600, z = (x, y) => 1.2 * Math.sin(x * 0.031) * Math.cos(y * 0.027) + 0.6 * Math.sin(x * 0.11 + y * 0.07), out = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x0 = -S / 2 + (i * S) / N, x1 = x0 + S / N, y0 = -S / 2 + (j * S) / N, y1 = y0 + S / N;
      out.push({ corners: [[x0, y0, z(x0, y0)], [x1, y0, z(x1, y0)], [x1, y1, z(x1, y1)], [x0, y1, z(x0, y1)]], fill: '#b0b0b0', sunShare: 0.7 });
    }
    return out;
  })();
  async function hourDark(faces, elevationDeg) {
    const e = (elevationDeg * Math.PI) / 180, toLight = [Math.cos(e) * 0.6, Math.cos(e) * 0.8, Math.sin(e)], TW = 640, TH = 400;
    const TCAM = { pos: [0, -250, 3.5], target: [0, 50, 0], vfov: 50 };
    const lum = async (shadows) => {
      const page = await browser.newPage();
      await page.setViewport({ width: TW, height: TH });
      await page.setContent(emitThreeWorld({ viewBox: { width: TW, height: TH }, inline: true, capture: true, hud: false, faces, ...(shadows ? { shadows } : {}) }), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 30000 });
      const d = await page.evaluate((CAM) => {
        window.__mojCapture.frame(CAM); window.__mojCapture.frame(CAM);
        const cv = document.querySelector('canvas'), c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
        const g = c2.getContext('2d'); g.drawImage(cv, 0, 0);
        const px = g.getImageData(0, 0, c2.width, c2.height).data, out = [];
        for (let i = 0; i < px.length; i += 4) out.push(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
        return out;
      }, TCAM);
      await page.close();
      return d;
    };
    const base = await lum(null), hour = await lum({ hour: true, toLight });
    let ground = 0, dark = 0;
    for (let i = 0; i < base.length; i++) { if (base[i] < 20) continue; ground++; if (1 - hour[i] / Math.max(1, base[i]) > 0.04) dark++; }
    return dark / ground;
  }

  it('the hour\'s map lays no moire on wide terrain under a low sun, and keeps a caster\'s shadow on it', async () => {
    if (!browser) return;
    // (in SwiftShader, before the receiver's slope was in the bias: 99.9 % of the ground darkened under a 15° sun, 68 %
    // under 25°; after: 0.02 % and 0.01 %)
    for (const el of [15, 25]) expect(await hourDark(TERRAIN, el)).toBeLessThan(0.005);
    // a 12 m tower 70 m ahead of the eye: its shadow lies on the ground, so some of it darkens, and no more than that
    const tower = boxFaces([14, -184, 0], [20, -178, 12], '#b0b0b0');
    const withTower = await hourDark([...TERRAIN, ...tower], 25);
    expect(withTower).toBeGreaterThan(0.001);
    expect(withTower).toBeLessThan(0.05);
  }, 180000);

  it('the half tier\'s occlusion still darkens the floor at a box\'s foot, alone and beside the creases', async () => {
    if (!browser) return;
    const faces = [half(-24, 24), ...boxFaces([-1, -1, 0], [1, 1, 2])];
    for (const creases of [false, true]) {
      const { page, errors } = await open({ faces, ...(creases ? { creases: true } : {}), occlusion: { strength: 1, reach: 0.8 }, lightTier: { tier: 'half', mapSize: 1024, ao: 0.5 } });
      for (let i = 0; i < 2; i++) await frameRow(page);
      const on = await frameRow(page);
      const off = await (async () => { await page.evaluate(() => window.__mojOcclusion.set(false)); return frameRow(page); })();
      const diff = on.map((v, i) => off[i] - v);
      const b = await page.evaluate(() => window.__mojLight.budget());
      expect(Math.max(...diff)).toBeGreaterThan(0.04);
      expect(diff[2]).toBeLessThan(0.02);
      // alone the prepass at half the frame and its pass at a quarter; beside the creases the prepass whole, its pass a quarter
      expect(b.targets.prepass).toEqual(creases ? [W, H] : [W / 2, H / 2]);
      expect(b.targets.occlusion).toEqual([W / 4, H / 4]);
      expect(errors).toEqual([]);
      await page.close();
    }
  }, 120000);

  it('the pass budget on a hero\'s level, by tier: what a frame renders and draws, never how long it takes', async () => {
    if (!browser) return;
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const { quickWorld } = await import('../gameworld/quick.js');
    const { readGameworld } = await import('../gameworld/world.js');
    const { gameStages, stageLevelOrder } = await import('../gameworld/levels.js');
    // a quick game's level (a trail on the valley's cube at golden hour), its hero a body of its own (no stored figure)
    const level = (geocube, extra = {}) => {
      const Wd = quickWorld({ id: 'gate', quick: { goal: 'reach' }, style: { geocube, hour: 'golden' } }), G = readGameworld(Wd), [stage] = gameStages(Wd);
      const m = stageLevelOrder(G, stage, { ref: 'x', heroRef: 'h' }).args.manifest, [hero, ...rest] = m.entities;
      return { ...m, figures: undefined, entities: [{ ...hero, body: { type: 'mesh', shape: 'box', size: [0.5, 0.4, 1.8] } }, ...rest], ...extra };
    };
    const VW = 800, VH = 500, G7 = { from: 'valley-morning', era: 'gen-7' };
    const measure = async (m) => {
      const { payload } = await resolveWorldScene({ manifest: m, title: 'gate' });
      const page = await browser.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (x) => { if (x.type() === 'error') errors.push(x.text()); });
      await page.setViewport({ width: VW, height: VH });
      await page.setContent(emitThreeWorld({ ...payload, viewBox: { width: VW, height: VH }, inline: true, capture: true, hud: false, walk: true }), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 120000 });
      const r = await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__mojCapture.frame(); const L = window.__mojLight; return L ? { ...L, budget: L.budget ? L.budget() : undefined } : {}; });
      await page.close();
      return { ...r, errors, payload };
    };
    // a hero on the gen-6 cube, a screen's tier: the actors' map each frame, nothing else
    const g6 = await measure(level('valley-morning'));
    expect(g6.payload.shadows).toEqual({ actors: true });
    expect(g6.budget).toMatchObject({ tier: 'full', maps: [2048], targets: {} });
    expect(g6.budget.frame).toMatchObject({ renders: 1, shadowPasses: 1, shadowMaps: 1 });
    expect(g6.budget.frame.shadowDraws).toBeLessThanOrEqual(4);   // what moves, not the stage (2 in SwiftShader)
    // gen-7, full: the hour's map drawn once in five frames; the prepass and the occlusion pass each frame
    const g7 = await measure(level(G7));
    expect(g7.budget).toMatchObject({ tier: 'full', maps: [2048, 2048], targets: { prepass: [VW, VH], occlusion: [VW / 2, VH / 2] } });
    expect(g7.budget.frame).toMatchObject({ renders: 3, shadowPasses: 1, shadowMaps: 1 });
    expect(g7.budget.frame.shadowDraws).toBeLessThanOrEqual(4);
    expect([g7.hourMaps, g7.hourDraws]).toEqual([1, 1]);
    // gen-7 on a tablet: half, the maps at 1024, the occlusion at a quarter of the frame
    const tab = await measure(level(G7, { screen: 'tablet' }));
    expect(tab.budget).toMatchObject({ tier: 'half', maps: [1024, 1024], targets: { prepass: [VW / 2, VH / 2], occlusion: [VW / 4, VH / 4] } });
    expect(tab.budget.frame.renders).toBe(3);
    // gen-7 on a phone: half, no occlusion by default: one render a frame, the actors' map in it
    const phone = await measure(level(G7, { screen: 'phone' }));
    expect(phone.budget).toMatchObject({ tier: 'half', maps: [1024, 1024], targets: {} });
    expect(phone.budget.frame).toMatchObject({ renders: 1, shadowPasses: 1, shadowMaps: 1 });
    // off: no live light on the page at all
    const off = await measure(level(G7, { light: { tier: 'off' } }));
    expect(off.budget).toBeUndefined();
    for (const r of [g6, g7, tab, phone, off]) expect(r.errors).toEqual([]);
  }, 300000);
});
