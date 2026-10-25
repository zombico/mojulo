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
    expect(s.half).toBe(12);   // the box round the focus, at the default span, in the first frame asked
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
});
