import { describe, it, expect } from 'vitest';
import { MATTER } from './matter.js';
import { groundField, crater } from './ground.js';
import { fragmentsOf, splashOf, dirtOf } from './debris.js';

const box = { min: [0, 0, 0], max: [1, 0.5, 0.4] }, V = 0.2;
const kinetic = (ps) => ps.reduce((a, p) => a + 0.5 * p.kg * (p.vel[0] ** 2 + p.vel[1] ** 2 + p.vel[2] ** 2), 0);

describe('debris of solids: deterministic in the force', () => {
  it('the same blow leaves the same pieces', () => {
    const a = fragmentsOf({ matter: 'concrete', box, joules: 1e5, how: 'burst', from: [0.5, -2, 0.2] });
    const b = fragmentsOf({ matter: 'concrete', box, joules: 1e5, how: 'burst', from: [0.5, -2, 0.2] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a harder blow leaves more, finer, faster pieces and more dust; mass is kept', () => {
    const soft = fragmentsOf({ matter: 'concrete', box, joules: 2e4, how: 'burst', from: [0.5, -2, 0.2] });
    const hard = fragmentsOf({ matter: 'concrete', box, joules: 2e6, how: 'burst', from: [0.5, -2, 0.2] });
    expect(hard.pieces.length).toBeGreaterThan(soft.pieces.length);
    expect(hard.stats.mean).toBeLessThan(soft.stats.mean);
    expect(hard.stats.dustShare).toBeGreaterThan(soft.stats.dustShare);
    expect(kinetic(hard.pieces) / hard.pieces.reduce((a, p) => a + p.kg, 0)).toBeGreaterThan(kinetic(soft.pieces) / soft.pieces.reduce((a, p) => a + p.kg, 0));
    for (const f of [soft, hard]) expect(f.pieces.reduce((a, p) => a + p.kg, 0) + (f.dust ? f.dust.kg : 0)).toBeCloseTo(MATTER.concrete.density * V, 6);
  });

  it('the kinetic share is exact, and a burst throws the pieces away from where it went off', () => {
    const f = fragmentsOf({ matter: 'brick', box, joules: 5e4, how: 'burst', from: [0.5, -2, 0.2] });
    expect(kinetic(f.pieces)).toBeCloseTo(0.3 * 5e4, 3);
    expect(f.pieces.every((p) => p.vel[1] > 0)).toBe(true);
  });

  it('fracture energy is the character: the same joules shatter glass and split timber; steel tears into a few plates', () => {
    const hit = (matter, joules) => fragmentsOf({ matter, box, joules, how: 'shot', dir: [0, 1, 0] });
    expect(hit('glass', 1e5).pieces.length).toBeGreaterThan(5 * hit('timber', 1e5).pieces.length);
    expect(hit('glass', 1e7).pieces.length).toBe(0);                     // ten megajoules into glass: powder
    expect(hit('glass', 1e7).stats.dustShare).toBeCloseTo(1, 6);
    expect(hit('steel', 0).pieces.length).toBeLessThanOrEqual(8);       // what it takes to break steel at all tears it in a few
    const splinters = hit('timber', 1e5).pieces;
    expect(splinters.every((p) => p.size[0] >= p.size[1] && p.size[0] >= p.size[2])).toBe(true);   // along the long axis
  });

  it('a burn leaves ash, a melt its liquid', () => {
    expect(fragmentsOf({ matter: 'pine', box, joules: 0, how: 'burn' }).dust.kg).toBeCloseTo(MATTER.pine.density * V * 0.01, 6);
    expect(fragmentsOf({ matter: 'ice', box, joules: 0, how: 'melt' }).liquid.kg).toBeCloseTo(MATTER.ice.density * V, 6);
  });
});

describe('dirt and splash', () => {
  it('a crater throws its ejecta as clods: the volume kept, the energy under the charge\'s, the bowl\'s middle flying farthest', () => {
    const f = groundField({ origin: [-8, -8], size: [16, 16], cell: 0.25, soil: 'loam', soilDepth: 3 });
    const C = crater(f, { at: [0, 0], joules: 4e6 }), D = dirtOf(C, { at: [0, 0], joules: 4e6, soil: 'loam' });
    expect(D.clods.reduce((a, c) => a + c.size ** 3, 0)).toBeCloseTo(C.ejected, 6);
    expect(D.stats.kinetic).toBeLessThanOrEqual(0.25 * 4e6 + 1e-6);
    const reach = (c) => Math.hypot(c.vel[0], c.vel[1]), from = (c) => Math.hypot(c.at[0], c.at[1]);
    const inner = D.clods.reduce((a, c) => (from(c) < from(a) ? c : a)), outer = D.clods.reduce((a, c) => (from(c) > from(a) ? c : a));
    expect(reach(inner)).toBeGreaterThan(reach(outer));
    expect(JSON.stringify(dirtOf(C, { at: [0, 0], joules: 4e6, soil: 'loam' }))).toBe(JSON.stringify(D));
  });

  it('water splashes, lava plops or barely lifts; a harder hit splashes more', () => {
    const hit = (liquid, speed) => splashOf({ liquid, at: [0, 0, 0], speed, mass: 40, size: 0.5 });
    const w = hit('water', 6), lava = hit('lava', 6);
    expect(w.plop).toBe(false);
    expect(w.droplets.length).toBeGreaterThan(0);
    expect(lava.stats.kinetic).toBeLessThan(w.stats.kinetic / 100);
    expect(hit('water', 12).stats.kg).toBeGreaterThan(w.stats.kg);
    expect(JSON.stringify(hit('water', 6))).toBe(JSON.stringify(w));
  });
});
