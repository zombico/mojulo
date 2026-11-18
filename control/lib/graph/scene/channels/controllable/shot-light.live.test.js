// The shot light on a side map's page (shot-light-view.js; an e2e suite: a real browser, skipped when none is installed).
// The concepts: only a side map's page carries it; on one, the map's materials carry the light, a round in flight is a
// light the page lays; its light on the wall is spill, not flood: a pool round it, its lift held by the cap, none far off.
// A buster's full charge in flight is drawn in its look: read on the page, a white-hot core, its hue peaking in its
// falloff, a thin accent (the rings it leaves where it was fired, read as it leaves them). A crate a round blows apart
// (rupa) is lit as it comes apart, in the round's colour, and the chunks it scatters take the shot light (the shot's look's laws,
// benchmark.js roundLaws). On a buster's page an explosion (a crate blown apart) is drawn in the same light and read by
// the same laws.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../chromium.js';
import { decodeImage } from '../../visual-gate.js';
import { feelRule } from '../../../gameworld/feel/lower.js';
import { SHOT_LIGHT } from '../../../worlds/controllable/shot-light.js';
import { measureRound, roundLaws } from '../../../gameworld/side-map/benchmark.js';
import { blockMatter } from '../../../rupa/matter.js';
import { piecesOf } from '../../../playscape/destruct/breakability.js';

const hero = { id: 'p1', pilotable: true, transform: { pos: [0, 0, 0], heading: Math.PI / 2 }, rule: { type: 'platform', eye: 1, speed: 6, collideHeight: 1.6 }, ambient: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] } };
// (the lane along +y, the camera on +x: a floor, and a wall facing the camera behind the lane)
const floor = { corners: [[-2, -20, 0], [2, -20, 0], [2, 20, 0], [-2, 20, 0]], normal: [0, 0, 1], fill: '#3a4048', group: 'sidemap:rock' };
const wall = { corners: [[-1.5, -20, 0], [-1.5, 20, 0], [-1.5, 20, 8], [-1.5, -20, 8]], normal: [1, 0, 0], fill: '#30363e', group: 'sidemap:back' };
const zone = { rect: [-20, 20, -2, 10], lock: 'z', checkpoint: [0, 0] };
const camera = (rule) => (rule === 'side-map' ? { rule, target: 'p1', screen: [24, 13.5], dist: 18, tilt: 0.05, lookH: 1.2, zones: [zone] } : { rule, target: 'p1' });
const page = (rule, h = hero) => emitThreeWorld({ faces: [floor, wall], entities: [h], camera: camera(rule), inline: true });
// (a hero with Galaxy Boy's buster: its rounds drawn in their look, gameworld/feel/round-look.js)
const buster = { ...hero, rule: { ...hero.rule, buster: feelRule({ pole: 'galaxy-boy', takes: true }).buster } };

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the shot light on a side map\'s page', () => {
  it('only a side map\'s page carries it', () => {
    expect(page('side')).not.toContain('__shotLights');
    expect(page('side-map')).toContain('__shotLights');
  });

  it('a round beside the wall lights it', async () => {
    if (!browser) return;
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.setContent(page('side-map'), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.shotLight, { timeout: 20000 });
    const frames = (n) => p.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    // (the side map's camera settled on its hero first: a frame still easing in would read as light)
    await frames(60);
    expect(errors).toEqual([]);
    expect((await p.evaluate(() => window.__mojCtrl.shotLight())).patched).toBeGreaterThan(0);
    // (the frame's lightness, the round held a little in front of the wall: its own drawing a few pixels of it, its light
    // a pool on the wall around it)
    const band = () => p.screenshot();
    const quiet = await band();
    await p.evaluate(() => { const W = window.__mojCtrl.world; W.projectiles = [{ id: 'x', owner: 'f', pos: [-1.2, -3, 2.2], vel: [0, 0, 0], pellet: true, fxScale: 0.3, fxColor: 0x5dff7a, fuse: 999, age: 0, born: W.time, gravity: 0, projRadius: 0.01, noGround: true }]; W.bursts = W.bursts || []; W.projSeq = 1; W.burstSeq = 0; });
    await frames(10);
    const L = await p.evaluate(() => window.__mojCtrl.shotLight().lights);
    expect(L.length).toBe(1);
    const lit = await band();
    // (each pixel's lift, the frame with the round over the frame without, read in a ring round the round's drawing (its
    // brightest change), so its own glow is left out: the pool, and how far it reaches)
    const R = await p.evaluate(async ([a64, b64]) => {
      const px = async (b) => { const img = new Image(); img.src = 'data:image/png;base64,' + b; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return { d: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }; };
      const A = await px(a64), B = await px(b64), Y = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2], W = A.w;
      let top = -1, at = 0;
      for (let i = 0; i < A.d.length; i += 4) { const l = Y(B.d, i) - Y(A.d, i); if (l > top) { top = l; at = i / 4; } }
      const ax = at % W, ay = Math.floor(at / W);
      let peak = 0, lifted = 0, far = 0, fn = 0;
      for (let i = 0; i < A.d.length; i += 4) {
        const x = (i / 4) % W, y = Math.floor(i / 4 / W), r = Math.hypot(x - ax, y - ay), l = Y(B.d, i) - Y(A.d, i);
        if (r > 30 && r < 160) { peak = Math.max(peak, l); if (l > 3) lifted++; }
        if (r > W * 0.4 && y > A.h * 0.3) { far = Math.max(far, l); fn++; }
      }
      return { peak, lifted: lifted / (A.w * A.h), far, fn };
    }, [quiet.toString('base64'), lit.toString('base64')]);
    // spill, not flood: a pool round the round (a few percent of the frame), its brightest lift held by the cap, none far off
    expect(R.peak).toBeGreaterThan(8);
    expect(R.peak).toBeLessThan(60);
    expect(R.lifted).toBeGreaterThan(0.01);
    expect(R.lifted).toBeLessThan(0.25);
    expect(R.fn).toBeGreaterThan(1000);
    expect(R.far).toBeLessThan(2);
    await p.close();
  }, 90000);

  it('a buster\'s full charge reads in its look: a white core, the hue in its falloff, a thin accent', async () => {
    if (!browser) return;
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.setContent(page('side-map', buster), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.shotLight, { timeout: 20000 });
    const frames = (n) => p.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    await frames(60);
    const quiet = await p.screenshot();
    await p.evaluate(() => { const W = window.__mojCtrl.world, B = W.byId.p1.rule.buster, L = B.levels[B.levels.length - 1]; W.projectiles = [{ id: 'x', owner: 'f', pos: [-0.6, -3, 2.2], vel: [0, 0.01, 0], pellet: true, busterLv: B.levels.length, fxScale: L.size, fxColor: L.color, fuse: 999, age: 0, born: W.time, gravity: 0, projRadius: 0.01, noGround: true }]; W.bursts = W.bursts || []; W.projSeq = 1; W.burstSeq = 0; });
    // (read just after it is fired: its accent is the rings it leaves at the firing point, here where it hangs, and they
    // fade within a third of a second)
    await frames(3);
    const lit = await p.screenshot();
    expect(errors).toEqual([]);
    const [q, l] = await Promise.all([decodeImage(quiet), decodeImage(lit)]);
    const M = measureRound({ page: l, quiet: q }, { r: Math.round(l.W * 0.1) });
    const laws = Object.fromEntries(roundLaws(M).map((x) => [x.id, x]));
    for (const id of ['white-core', 'hue-in-falloff', 'accent-thin']) expect(laws[id].holds, laws[id].says).toBe(true);
    await p.close();
  }, 90000);

  it('a crate blown apart is lit as it comes apart, in the round\'s colour, and its chunks take the light', async () => {
    if (!browser) return;
    const box = { min: [-0.5, -3.5, 0], max: [0.5, -2.5, 1] }, crate = { id: 'crate', ...box, hp: 1, ...blockMatter(box, 'pine') };
    const [x0, y0, z0] = box.min, [x1, y1, z1] = box.max, f = (corners, normal) => ({ corners, normal, fill: '#8a6a3a', group: 'break:crate' });
    const faces = [f([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]), f([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]),
      f([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]), f([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]), f([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0])];
    const html = emitThreeWorld({ faces: [floor, wall, ...faces], entities: [hero], breakables: [crate], breakPieces: piecesOf([crate], faces), rupa: {}, camera: camera('side-map'), inline: true });
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.setContent(html, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.shotLight, { timeout: 20000 });
    const frames = (n) => p.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    await frames(30);
    const before = await p.evaluate(() => window.__mojCtrl.shotLight().patched);
    // (a green round bursts on it and the blow breaks it)
    await p.evaluate(() => { const C = window.__mojCtrl, W = C.world; W.bursts = W.bursts || []; W.bursts.push({ seq: 99, pos: [0, -3, 0.5], t: W.time, radius: 0.4, fxColor: 0x5dff7a }); W.burstSeq = 100; C.strike('crate', 1e7, 'blast', { at: [0, -3, 0.5] }); });
    await frames(8);
    const after = await p.evaluate(() => ({ s: window.__mojCtrl.shotLight(), broke: (window.__mojCtrl.world.breaks || []).length }));
    expect(errors).toEqual([]);
    expect(after.broke).toBeGreaterThan(0);
    // (its light: a break's reach, the green round's colour)
    const L = after.s.lights.find((l) => l.reach === SHOT_LIGHT.broke[0]);
    expect(L).toBeTruthy();
    expect(L.color[1]).toBe(1);
    // (the chunks it scattered, each its own material, found and lit)
    expect(after.s.patched).toBeGreaterThan(before);
    await p.close();
  }, 90000);

  it('on a buster\'s page an explosion is drawn in the shot\'s light: a white core, its hue in the falloff, a thin accent', async () => {
    if (!browser) return;
    const box = { min: [-0.6, -3.6, 0], max: [0.6, -2.4, 1.2] }, crate = { id: 'crate', ...box, hp: 1, ...blockMatter(box, 'pine') };
    const [x0, y0, z0] = box.min, [x1, y1, z1] = box.max, f = (corners, normal) => ({ corners, normal, fill: '#8a6a3a', group: 'break:crate' });
    const faces = [f([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]), f([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1])];
    const html = emitThreeWorld({ faces: [floor, wall, ...faces], entities: [buster], breakables: [crate], breakPieces: piecesOf([crate], faces), rupa: {}, camera: camera('side-map'), inline: true });
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.setContent(html, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.shotLight, { timeout: 20000 });
    const frames = (n) => p.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    await frames(60);
    const quiet = await p.screenshot();
    await p.evaluate(() => { const C = window.__mojCtrl, W = C.world; W.bursts = W.bursts || []; W.bursts.push({ seq: 99, pos: [0, -3, 0.6], t: W.time, radius: 0.4, fxColor: 0xffd23a }); W.burstSeq = 100; C.strike('crate', 1e7, 'blast', { at: [0, -3, 0.6] }); });
    // (held a moment after it goes off, the world paused (a menu's freeze), so the frame read is the same every run)
    await p.waitForFunction(() => { const W = window.__mojCtrl.world, b = (W.breaks || [])[0]; return b && W.time - b.t >= 0.04; }, { timeout: 5000, polling: 'raf' });
    await p.evaluate(() => { window.__mojFreeze = true; });
    await frames(3);
    const lit = await p.screenshot();
    expect(errors).toEqual([]);
    const [q, l] = [decodeImage(quiet), decodeImage(lit)];
    const laws = Object.fromEntries(roundLaws(measureRound({ page: l, quiet: q }, { r: Math.round(l.W * 0.12) })).map((x) => [x.id, x]));
    for (const id of ['white-core', 'hue-in-falloff', 'accent-thin']) expect(laws[id].holds, laws[id].says).toBe(true);
    await p.close();
  }, 90000);
});
