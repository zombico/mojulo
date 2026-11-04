import { describe, it, expect } from 'vitest';
import { rupaPhysics } from './index.js';
import { settleSpeed } from './debris.js';
import { solveSmoke, puffsAt } from './smoke-solver.js';

const P = rupaPhysics;
const steady = (speed, terrain = 'open') => P.windOf({ speed, dir: 0, terrain });
const puff = (o = {}) => ({ at: [0, 0, 10], t0: 0, m0: 0.01, sigma0: 0.5, vs: 0, F: 0, K: 1000, seed: 1, ...o });

describe('a puff on the wind: its own script', () => {
  it('one settling law: Stokes for fine grains, Newton for coarse; the debris settles by the same', () => {
    expect(P.settleOf(1e-5, 2650)).toBeLessThan(0.01);    // 10 µm: millimetres a second, it hangs
    expect(P.settleOf(1e-3, 2650)).toBeGreaterThan(1);    // 1 mm: metres a second, it falls
    expect(settleSpeed(5e-5, 2400)).toBe(P.settleOf(5e-5, 2400));
  });

  it('it moves at the wind of its height, and stays put in still air', () => {
    const w = steady(5), q = P.puffAt(puff(), w, 8);
    expect(q.pos[0]).toBeCloseTo(5 * 8, 6);                // U(10 m) is the reference speed
    expect(Math.abs(q.pos[2] - 10)).toBeLessThan(q.sigma);   // it wanders, by no more than it has spread
    const low = P.puffAt(puff({ at: [0, 0, 1] }), w, 8);
    expect(low.pos[0]).toBeLessThan(q.pos[0]);            // slower near the ground
    expect(P.puffAt(puff(), null, 8).pos[0]).toBeCloseTo(0, 6);
  });

  it('smoke rises on its heat by the plume law, less in a stronger wind, to a final height', () => {
    const F = P.buoyancyOf(6e5);
    expect(F).toBeCloseTo((9.81 * 6e5) / (Math.PI * 1005 * P.AIR.density * 293), 9);
    const r30 = P.riseOf(F, 5, 30);
    expect(r30).toBeGreaterThan(10); expect(r30).toBeLessThan(20);   // a 600 kW fire's smoke in a 5 m/s wind: ~15 m
    expect(P.riseOf(F, 10, 30)).toBeLessThan(r30);
    expect(P.riseOf(F, 5, 600)).toBeCloseTo(P.riseOf(F, 5, 6000), 9);   // it levels off
    expect(P.riseOf(P.buoyancyOf(6e6), 5, 30)).toBeGreaterThan(r30);     // a bigger fire's goes higher
  });

  it('it spreads as the air mixes it, faster over rough ground, and the same mass fades as it spreads', () => {
    const a = P.puffAt(puff(), steady(5, 'sea'), 10), b = P.puffAt(puff(), steady(5, 'city'), 10);
    expect(b.sigma).toBeGreaterThan(a.sigma);
    let last = Infinity;
    for (const t of [0, 2, 5, 10, 20]) { const q = P.puffAt(puff(), steady(5), t); expect(q.alpha).toBeLessThan(last + 1e-12); last = q.alpha; }
    expect(P.puffAt(puff(), steady(5), 0).alpha).toBeCloseTo(1 - Math.exp(-(1000 * 0.01) / (Math.PI * 0.25)), 9);
  });

  it('dust deposits as it settles; steam evaporates', () => {
    const fine = P.puffAt(puff({ at: [0, 0, 8], vs: 0.007 }), steady(3), 20), coarse = P.puffAt(puff({ at: [0, 0, 8], vs: 0.2 }), steady(3), 20);
    expect(coarse.m).toBeLessThan(fine.m);
    expect(fine.pos[2] - coarse.pos[2]).toBeCloseTo((0.2 - 0.007) * 20, 1);   // settled apart (their wander near alike)
    expect(P.puffAt(puff({ evap: 1.5 }), null, 3).m).toBeCloseTo(0.01 * Math.exp(-2), 9);
  });
});

describe('the smoke solver: each source decided by its physics', () => {
  const wind = { speed: 4, dir: 90, gust: 0.2 };
  const sources = [
    { id: 'fire', kind: 'fire', at: [0, 0, 1], Q: 4e5, fuel: 4e5 / 15e6, t0: 0 },
    { id: 'rubble', kind: 'dust', at: [5, 0, 0.5], kg: 20, grain: { x0: 5e-4, n: 1.2 }, particle: 2400, radius: 1, t0: 1 },
    { id: 'speck', kind: 'dust', at: [9, 0, 0.5], kg: 1e-6, t0: 0 },
    { id: 'hiss', kind: 'steam', at: [0, 3, 1], kg: 0.3, t0: 2 },
  ];

  it('a fire is a plume, a break\'s dust and a burst of steam are puffs; coarse dust falls out; a speck is not seen', () => {
    const S = solveSmoke(sources, wind);
    expect(S.plumes.map((p) => p.id)).toEqual(['fire']);
    expect(S.plumes[0].rate).toBeGreaterThan(0);
    const rubble = S.puffs.filter((p) => p.id === 'rubble');
    expect(new Set(rubble.map((p) => p.d)).size).toBeGreaterThan(0);
    expect(rubble.every((p) => P.settleOf(p.d, 2400) < 1)).toBe(true);                 // only what the air holds hangs
    expect(S.fallout.filter((f) => f.id === 'rubble').every((f) => f.vs >= 0.1)).toBe(true);
    expect(S.fallout.some((f) => f.id === 'rubble')).toBe(true);
    expect(S.puffs.some((p) => p.id === 'hiss' && p.kind === 'steam')).toBe(true);
    expect(S.skipped).toEqual(['speck']);
    for (const id of ['fire', 'rubble', 'hiss']) expect(S.reasons[id].length).toBeGreaterThan(0);
  });

  it('what is in sight at a time: the plume trails downwind, the dust drifts, and nothing before it began', () => {
    const S = solveSmoke(sources, wind), at0 = puffsAt(S, wind, 0.5), later = puffsAt(S, wind, 8);
    expect(at0.some((q) => q.id === 'rubble' || q.id === 'hiss')).toBe(false);
    const trail = later.filter((q) => q.id === 'fire');
    expect(trail.length).toBeGreaterThan(4);
    expect(Math.max(...trail.map((q) => q.pos[1]))).toBeGreaterThan(5);                 // carried toward +y
    expect(Math.max(...trail.map((q) => q.pos[2]))).toBeGreaterThan(2);                 // and up
    expect(later.some((q) => q.id === 'rubble')).toBe(true);
  });

  it('a plume stops when its fire does', () => {
    const S = solveSmoke([{ ...sources[0], t1: 3 }], wind);
    expect(puffsAt(S, wind, 2).length).toBeGreaterThan(0);
    expect(puffsAt(S, wind, 3 + S.plumes[0].life + 1)).toEqual([]);
  });

  it('it is checked, and deterministic', () => {
    expect(() => solveSmoke([{ kind: 'mist', at: [0, 0, 0] }])).toThrow(/kind/);
    expect(() => solveSmoke([{ kind: 'fire', at: [0, 0, 0] }])).toThrow(/Q/);
    expect(() => solveSmoke([{ kind: 'dust', at: [0, 0] , kg: 1 }])).toThrow(/at/);
    expect(JSON.stringify(puffsAt(solveSmoke(sources, wind), wind, 6))).toBe(JSON.stringify(puffsAt(solveSmoke(sources, wind), wind, 6)));
  });
});
