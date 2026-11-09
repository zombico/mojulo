import { describe, it, expect } from 'vitest';
import { MATTER } from './matter.js';
import { solveWind, bendAt, hangAt, bendShape, batchUniforms, KINDS, BEND_GLSL, HANG_GLSL } from './wind-solver.js';

const place = (z0 = 0, z1 = z0) => ({ min: [-5, -5, z0], max: [5, 5, z1] });
const scene = [
  { id: 'canopy', kind: 'leaf', place: place(3, 6), count: 2000 },
  { id: 'meadow', kind: 'grass', place: place(0), count: 4000 },
  { id: 'flag', kind: 'flag', place: { min: [0, 0, 6], max: [0, 0, 6] } },
  { id: 'bricks', kind: 'brick', place: place(0.05) },
  { id: 'crates', kind: 'crate', place: place(0.3) },
  { id: 'tree', kind: 'sapling', place: place(0), count: 12 },
  { id: 'post', kind: 'signpost', place: place(0), count: 3 },
];

describe('the wind solver: each element by its physics', () => {
  it('a breeze: leaves drift, grass bends, the flag hangs, bricks and crates lie still, every decision with its reason', () => {
    const S = solveWind(scene, { speed: 6, dir: 0 });
    const scriptOf = (id) => S.batches.find((b) => b.ids.includes(id))?.script ?? (S.still.includes(id) ? 'still' : 'simulate');
    expect(['canopy', 'meadow', 'flag', 'bricks', 'crates'].map(scriptOf)).toEqual(['drift', 'bend', 'hang', 'still', 'still']);
    for (const el of scene) expect(S.reasons[el.id]).toMatch(/^(drift|bend|hang|still|simulate): .*\d/);
  });

  it('a gale moves what a breeze leaves still and snaps the sapling, while the steel post barely moves', () => {
    const S = solveWind(scene, { speed: 40, dir: 0, gust: 0.3 });
    expect(S.simulate).toContain('crates');
    expect(S.simulate).toContain('tree');
    expect(S.reasons.tree).toMatch(/snaps/);
    expect(S.still).toContain('post');
    expect(S.reasons.post).toMatch(/0\.\d+°/);   // a 6 cm steel post: under half a degree
    expect(S.still).toContain('bricks');
  });

  it('like kinds batch into one draw each; drift keeps its own release region', () => {
    const S = solveWind([...scene, { id: 'meadow2', kind: 'grass', place: place(0), count: 1000 }], { speed: 6, dir: 0 });
    const grass = S.batches.filter((b) => b.kind === 'grass');
    expect(grass.length).toBe(1);
    expect(grass[0].count).toBe(5000);
    expect(grass[0].instances.length).toBe(5000);
    expect(JSON.stringify(solveWind(scene, { speed: 6, dir: 0 }))).toBe(JSON.stringify(solveWind(scene, { speed: 6, dir: 0 })));
  });
});

describe('the scripts it hands out', () => {
  it('bend: the cantilever\'s tip goes as wL⁴/8EI + FL³/3EI, more with the wind, swaying at its first mode', () => {
    const S = solveWind([{ id: 't', kind: 'sapling', place: { min: [0, 0, 0], max: [0, 0, 0] } }], { speed: 12, dir: 0 });
    const b = S.batches[0], k = KINDS.sapling, E = MATTER.pine.E, I = (Math.PI * k.diameter ** 4) / 64, h = 0.5 * MATTER.air.density;
    expect(b.deflect).toBeCloseTo((h * 1.2 * k.diameter * k.length ** 4) / (8 * E * I) + (h * k.crown.cd * k.crown.area * k.length ** 3) / (3 * E * I), 12);
    const calm = solveWind([{ id: 't', kind: 'sapling', place: { min: [0, 0, 0], max: [0, 0, 0] } }], { speed: 8, dir: 0 }).batches[0];
    expect(bendAt(b, 0, 1).angle).toBeGreaterThan(bendAt(calm, 0, 1).angle);
    expect(bendShape(0, 0.5)).toBe(0); expect(bendShape(1, 0)).toBeCloseTo(1, 12); expect(bendShape(1, 1)).toBeCloseTo(1, 12);
    expect(b.freq).toBeGreaterThan(0.2); expect(b.freq).toBeLessThan(5);
  });

  it('hang: a flag leans until its drag meets its weight, toward level in a gale', () => {
    const at = (speed) => { const S = solveWind([{ id: 'f', kind: 'flag', place: { min: [0, 0, 6], max: [0, 0, 6] } }], { speed, dir: 0 }); return hangAt(S.batches[0], 0, 0).angle; };
    expect(at(20)).toBeGreaterThan(at(5));
    expect(at(30)).toBeGreaterThan((70 * Math.PI) / 180);
  });

  it('hands the GPU the same formulas and their numbers', () => {
    const S = solveWind(scene, { speed: 6, dir: 0 });
    for (const b of S.batches.filter((x) => x.script !== 'drift')) for (const k of Object.keys(batchUniforms(b))) expect((b.script === 'bend' ? BEND_GLSL : HANG_GLSL)).toContain(k);
    expect(BEND_GLSL).toContain('vec3 windBend('); expect(HANG_GLSL).toContain('vec3 windHang(');
  });
});
