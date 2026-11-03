// A boat underway on a course resolves to the World page's live water (seaway-scene.js, scene/channels/seaway.js): its
// own faces packed about its origin and back within a step of its scale, the static wake left to the live water, the
// course a loop its wake runs half round, the water's cells small against its waves, buoys round the loop; the page
// carries the channel only when asked, and its script parses. The cases are chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, CRAFT_ARCHETYPES as A, CRAFT_ODM } from '../craft-shelf/index.js';
import { assembleSeawayScene, packBoat, seawayWater } from './seaway-scene.js';
import { lowerAssemblerFaces } from './workbench-assembler.js';
import { seawayChannelScript } from '../scene/channels/seaway.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// (the smallest boat on an outboard: a light page)
const BOAT = Object.keys(A).filter((k) => A[k].realm === 'water' && A[k].layout.some((e) => CRAFT_ODM[e.sku].kind === 'boat-outboard'))
  .sort((a, b) => CRAFT_ODM[A[a].layout[0].sku].dims.length - CRAFT_ODM[A[b].layout[0].sku].dims.length)[0];
const u8 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

describe('a boat on a course: its manifest', () => {
  it('carries a seaway only on a course; its loop wide enough for its wake to run half round it', () => {
    const plain = assembleCraft(BOAT, { underway: { knots: 20 } }), run = assembleCraft(BOAT, { underway: { knots: 20, course: true } });
    expect(plain.manifest).not.toHaveProperty('seaway');
    const { seaway: S, ...rest } = run.manifest;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(plain.manifest));
    expect(S.course.loop).toBeGreaterThanOrEqual(S.wake.reach / Math.PI);
    expect(S.origin[2]).toBe(run.readout.afloat.waterline);
    expect(S.water).toBe('lake');
    expect(assembleCraft(BOAT, { underway: { knots: 20, course: { loop: 50, water: 'ocean' } } }).manifest.seaway).toMatchObject({ course: { loop: 50 }, water: 'ocean' });
  });
});

describe('a boat on a course: its World page', () => {
  const { manifest } = assembleCraft(BOAT, { underway: { knots: 20, course: true } }), P = assembleSeawayScene(manifest, { title: BOAT });
  it('packs the boat\'s own faces about its origin, back within a step of its scale; the static wake left out', () => {
    const own = lowerAssemblerFaces({ ...manifest, items: manifest.items.filter((i) => i.id !== 'wake') }).filter((f) => !f.studio);
    const tris = own.reduce((n, f) => n + f.corners.length - 2, 0);
    expect(P.seaway.boat.tris).toBe(tris);
    const pos = new Int16Array(u8(P.seaway.boat.pos).buffer), c = own[0].corners[0], o = manifest.seaway.origin;
    for (let i = 0; i < 3; i += 1) expect(Math.abs(pos[i] * P.seaway.boat.scale - (c[i] - o[i]))).toBeLessThanOrEqual(P.seaway.boat.scale);
    expect(u8(P.seaway.boat.col).length).toBe(tris * 9);
  });
  it('its water over the loop, its cells small against its waves and its length, at most its grid; buoys round the loop', () => {
    const W = seawayWater(manifest.seaway), w = manifest.seaway.wake, cell = W.size / (W.n - 1);
    expect(W.size).toBeGreaterThan(2 * manifest.seaway.course.loop);
    expect(W.n).toBeLessThanOrEqual(200);
    if (W.n < 200) expect(cell).toBeLessThanOrEqual(Math.min(w.divergent.wavelength, w.waterline.length) / 8 + 1e-9);
    expect(W.look.kind).toBe('lake');
    expect(P.faces.length).toBeGreaterThan(0);
    for (const f of P.faces) for (const c of f.corners) expect(Math.abs(Math.hypot(c[0] - P.seaway.course.center[0], c[1] - P.seaway.course.center[1]) - manifest.seaway.course.loop)).toBeGreaterThan(w.waterline.beam / 2);
    expect(P.cameras.map((c) => c.name)).toContain('chase');
  });
  it('the page carries the channel only when asked, and its script parses', () => {
    const script = seawayChannelScript({ ...P.seaway });
    expect(() => new Function('THREE', 'scene', 'camera', 'controls', script)).not.toThrow();
    const page = emitThreeWorld({ ...P, inline: false, hud: false });
    expect(page).toContain('stepSeaway(t)');
    expect(emitThreeWorld({ ...P, seaway: null, inline: false, hud: false })).not.toContain('stepSeaway');
  });
});
