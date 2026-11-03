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
  const crate = (soil, joules = 4e6) => { const f = groundField({ origin: [-8, -8], size: [16, 16], cell: 0.25, soil, soilDepth: 3 }), C = crater(f, { at: [0, 0], joules }); return { C, D: dirtOf(C, { at: [0, 0], joules, soil }) }; };

  it('a crater\'s ejecta flies as clumps, spray and dust, weighing what it threw, its energy under the charge\'s', () => {
    const { C, D } = crate('loam');
    expect(D.stats.kg).toBeCloseTo((C.ejected * MATTER.loam.density) / MATTER.loam.swell, 6);
    expect(D.clumps.length).toBeGreaterThan(0);
    expect(D.spray.parcels.length).toBeGreaterThan(0);
    expect(D.cloud.kg).toBeGreaterThan(0);
    expect(D.stats.kinetic).toBeLessThanOrEqual(0.25 * 4e6 + 1e-6);
    expect(JSON.stringify(crate('loam').D)).toBe(JSON.stringify(D));
  });

  it('cohesion decides what holds: dry sand flies all as spray, clay more in clumps than loam; the rim\'s slow soil lumps, the middle\'s tears', () => {
    expect(crate('sand').D.clumps.length).toBe(0);
    const share = (soil) => { const { D } = crate(soil); return D.stats.clumpKg / D.stats.kg; };
    expect(share('clay')).toBeGreaterThan(share('loam'));
    const { D } = crate('loam'), from = (p) => Math.hypot(p.at[0], p.at[1]);
    const inner = D.clumps.reduce((x, p) => (from(p) < from(x) ? p : x)), outer = D.clumps.reduce((x, p) => (from(p) > from(x) ? p : x));
    expect(outer.size).toBeGreaterThan(inner.size);
  });

  it('a harder charge throws faster and tears more of it; grain size is drag: silt slows sooner than sand', () => {
    const share = (j) => { const { D } = crate('loam', j); return D.stats.clumpKg / D.stats.kg; };
    expect(share(4e7)).toBeLessThan(share(4e5));
    expect(crate('clay').D.spray.drag).toBeGreaterThan(crate('sand').D.spray.drag);
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
