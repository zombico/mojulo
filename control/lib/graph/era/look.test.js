import { describe, it, expect } from 'vitest';
import { resolveLookSpec, applyLook, densify, LOOK_CELL, LOOK_MAX_FACES } from './look.js';
import { SIXTH_GEN_LOOK_IDS, SIXTH_GEN_REFERENCES, SIXTH_GEN_LOOKS } from './sixth-gen.js';
import { hexRgb } from './geom.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const DUNGEON = { kind: 'dungeon', chambers: [{ id: 'hub', at: [0, 0], elevation: 0, radius: 7, height: 9 }, { id: 'west', at: [-17, 5], elevation: -2.5, radius: 6, height: 8 }], tunnels: [{ from: 'hub', to: 'west', style: 'corridor' }] };
const CITY = { kind: 'fractal-city', seed: 1 };
const world = (manifest) => resolveWorldScene({ ref: 'sk_look_test', title: 'look test', manifest }).then((r) => r.payload);
const edge = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

describe('look: the spec', () => {
  it('is null when absent, takes an id or { id, cell }, and refuses an unknown look with the list', () => {
    expect(resolveLookSpec(undefined)).toBeNull();
    expect(resolveLookSpec('gothic-night')).toMatchObject({ id: 'gothic-night', cell: LOOK_CELL });
    expect(resolveLookSpec({ id: 'island-noon', cell: 4 }).cell).toBe(4);
    expect(() => resolveLookSpec('nope')).toThrow(/known: gothic-night/);
    expect(() => resolveLookSpec({ id: 'island-noon', cell: 0.1 })).toThrow(/cell/);
    for (const l of SIXTH_GEN_LOOK_IDS) expect(resolveLookSpec(l).ref).toBe(SIXTH_GEN_REFERENCES[SIXTH_GEN_LOOKS[l]]);
  });
});

describe('look: on a world that resolves to raw albedo', () => {
  it('absent, the world is the world it was: no look key, the same bytes', async () => {
    const a = await world(DUNGEON), b = await world({ ...DUNGEON, look: null });
    expect(a.look).toBeUndefined();
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('baked-light and vertex-density: every lit face is split to the cell and carries a colour per corner', async () => {
    const plain = await world(DUNGEON), p = await world({ ...DUNGEON, look: 'gothic-night' });
    expect(p.look).toMatchObject({ id: 'gothic-night', baked: true });
    expect(p.faces.length).toBeGreaterThan(plain.faces.length);
    const lit = p.faces.filter((f) => f.cornerFills);
    expect(lit.length).toBeGreaterThan(0.9 * p.faces.length);
    for (const f of lit) for (let i = 0; i < 4; i++) expect(edge(f.corners[i], f.corners[(i + 1) % 4])).toBeLessThanOrEqual(p.look.cell + 1e-6);
  });

  it('depth-by-air and sky-is-a-place: an exterior takes the look\'s fog and dome', async () => {
    const p = await world({ ...CITY, look: 'jungle-haze' }), R = SIXTH_GEN_REFERENCES.mgs3;
    expect(p.haze).toEqual({ color: R.air.fog.color, density: R.air.fog.density });
    expect(p.sky.zenith).toEqual(R.air.dome.zenith);
  }, 60000);

  it('the world\'s own lights are baked: the dungeon hands its torches over, and their flames are drawn', async () => {
    const p = await world({ ...DUNGEON, look: 'gothic-night' });
    expect(p.look.lights).toBeGreaterThan(0);
    expect(p.faces.some((f) => f.group === 'stage:fixture' && f.emissive)).toBe(true);   // the flames are back
    expect(p.lookNote).toBeUndefined();
  });

  it('an interior stays an interior: no sun, its own sky, the look\'s fog behind', async () => {
    const p = await world({ ...DUNGEON, look: 'island-noon' });
    expect(p.sky).toEqual({ preset: 'interior' });
    expect(p.bg).toBe(SIXTH_GEN_REFERENCES.sunshine.air.fog.color);
  });

  it('a sunless look on a world with no lights says it baked the ambient alone', async () => {
    const p = await world({ ...CITY, look: 'gothic-night' });
    expect(p.lookNote).toMatch(/no sun and the world places no lights/);
  }, 60000);

  it('is deterministic, and bounded on a whole city', async () => {
    const a = await world({ ...DUNGEON, look: 'desert-dusk' }), b = await world({ ...DUNGEON, look: 'desert-dusk' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = await world({ ...CITY, look: 'island-noon' });
    expect(c.look.baked).toBe(true);
    expect(c.look.cell).toBeGreaterThanOrEqual(LOOK_CELL);   // metres, whatever the city's own unit
    expect(c.faces.length).toBeGreaterThan(1.5 * (await world(CITY)).faces.length);   // most city faces are small already
    expect(c.faces.length).toBeLessThanOrEqual(LOOK_MAX_FACES + 2000);   // overlays and glows are kept whole
  }, 60000);
});

describe('look: on a kind that bakes its own light', () => {
  it('sets the air and sky only, and says so', () => {
    const p = applyLook({ faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#808080' }] }, resolveLookSpec('lab-dark'), { bake: false });
    expect(p.look).toEqual({ id: 'lab-dark', baked: false });
    expect(p.lookNote).toMatch(/air and sky only/);
    expect(p.faces[0].cornerFills).toBeUndefined();
    expect(p.haze.color).toBe(SIXTH_GEN_REFERENCES.doom3.air.fog.color);
  });

  it('densify grows the cell rather than pass the face cap', () => {
    const big = [{ corners: [[0, 0, 0], [400, 0, 0], [400, 400, 0], [0, 400, 0]], fill: '#808080' }];
    const d = densify(big, 0.5, 1000);
    expect(d.faces.length).toBeLessThanOrEqual(1000);
    expect(d.cell).toBeGreaterThan(0.5);
  });
});

// a 20 m grey floor and a 4 m grey block standing on it: a scene small enough to read each law off directly
const GREY = '#999999';
const quad = (a, b, c, d) => ({ corners: [a, b, c, d], fill: GREY });
function yard(extra = {}) {
  const faces = [quad([-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0])];
  const [x0, y0, x1, y1, h] = [-2, -2, 2, 2, 4];
  faces.push(quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]));
  faces.push(quad([x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]), quad([x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]));
  faces.push(quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]), quad([x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]));
  return { faces, ...extra };
}
// the light a corner received: its baked colour over the grey it was painted
const lightAt = (h) => hexRgb(h).map((v) => v / hexRgb(GREY)[0]);
const floorCorners = (p) => p.faces.filter((f) => f.cornerFills && f.corners.every((c) => c[2] === 0)).flatMap((f) => f.corners.map((c, i) => ({ c, light: lightAt(f.cornerFills[i]) })));

describe('look: the laws, read off a small scene', () => {
  it('shade-is-colour: the floor in the block\'s cast shadow is lit by the ambient, a cool colour, never black', () => {
    const p = applyLook(yard(), resolveLookSpec('island-noon'), { bake: true });
    const lit = floorCorners(p), mean = (L) => L.reduce((s, v) => s + v, 0) / 3;
    const shade = lit.reduce((a, b) => (mean(b.light) < mean(a.light) ? b : a)), sun = lit.reduce((a, b) => (mean(b.light) > mean(a.light) ? b : a));
    expect(mean(sun.light)).toBeGreaterThan(1.5 * mean(shade.light));   // a cast shadow, not an even wash
    expect(Math.min(...shade.light)).toBeGreaterThan(0.15);             // never black
    expect(shade.light[2]).toBeGreaterThan(shade.light[0]);            // and cool: the ambient is a blue
  });

  it('baked-light: a placed light pools on the floor under it and falls off with distance', () => {
    const p = applyLook(yard({ lights: [{ type: 'point', position: [7, 7, 2.5], color: [1, 0.66, 0.31] }] }), resolveLookSpec('gothic-night'), { bake: true });
    const lit = floorCorners(p), near = lit.filter(({ c }) => Math.hypot(c[0] - 7, c[1] - 7) < 2.5), far = lit.filter(({ c }) => Math.hypot(c[0] - 7, c[1] - 7) > 12);
    const avg = (xs) => xs.reduce((s, x) => s + x.light[0], 0) / xs.length;
    expect(near.length).toBeGreaterThan(0);
    expect(avg(near)).toBeGreaterThan(2.5 * avg(far));   // the stage torch: about 3× the ambient under it
    expect(p.faces.some((f) => f.emissive)).toBe(true);
  });

  it('vertex-density: a 20 m floor gets corners every cell, so a pool has vertices to land on', () => {
    const p = applyLook(yard(), resolveLookSpec('island-noon'), { bake: true });
    expect(p.faces.filter((f) => f.corners.every((c) => c[2] === 0)).length).toBe((20 / LOOK_CELL) ** 2);
  });
});
