// ficus — the figs: aerial roots that land join the pipe model, the fig parts ride the ladder's cuts, the species pool,
// and the terrain's opt-in rows.
import { describe, it, expect } from 'vitest';
import { grow, measure, ARCHITECTURES } from './grow.js';
import { ladder } from './ladder.js';
import { FIGS, figTris, rootChains, buttressTris } from './ficus.js';
import { plantPool } from './pool.js';
import { SPECIES } from './species.js';
import { plantsConfig, plantsKernel, validateTerrainPlants } from '../terrain/terrain-plants.js';
import { atlasField } from '../terrain/terrain-atlas.js';
import { PER } from '../terrain/vegetation-kernel.js';
import { resolveLandscapePlants, validatePaintedLandscape } from '../polygonizer/painted-landscape.js';

const nodesOf = (p) => JSON.stringify(p.nodes.map((n) => [n.pos, n.r, n.died ?? 0, n.leaves]));
const banyan = grow(FIGS.banyan, { years: SPECIES.banyan.years, seed: 3 });

describe('aerial roots (grow.js, opt-in)', () => {
  it('absent, a plant grows as before and carries no roots', () => {
    // "as before" is held by plants.char.test.js's pins; this compares the engine with itself: determinism, no key
    const a = grow(ARCHITECTURES.rauh, { years: 8, seed: 2 }); const b = grow({ ...ARCHITECTURES.rauh }, { years: 8, seed: 2 });
    expect(nodesOf(a)).toBe(nodesOf(b)); expect('roots' in a).toBe(false);
  });
  it('a banyan drops roots; the landed ones stand on the ground and outgrow the hanging ones', () => {
    const landed = banyan.roots.filter((q) => q.landed), hanging = banyan.roots.filter((q) => !q.landed);
    expect(landed.length).toBeGreaterThan(5);
    for (const q of hanging) expect(q.len).toBeLessThan(banyan.nodes[q.node].pos[2]);
    expect(Math.max(...landed.map((q) => q.r))).toBeGreaterThan(8 * Math.max(...hanging.map((q) => q.r), 0.004));
    for (const ch of rootChains(banyan).filter((c) => c.landed)) expect(ch.pts[0][2]).toBe(0);
  });
  it('a landed root takes pipes from the trunk: the first trunk thins among its pillars', () => {
    const { aerial, ...rootless } = FIGS.banyan; void aerial;
    expect(measure(banyan).dbh).toBeLessThan(measure(grow(rootless, { years: SPECIES.banyan.years, seed: 3 })).dbh);
  });
  it('same seed, same plant', () => {
    expect(nodesOf(grow(FIGS.banyan, { years: 12, seed: 9 }))).toBe(nodesOf(grow(FIGS.banyan, { years: 12, seed: 9 })));
  });
});

describe('fig parts on the ladder', () => {
  const H = measure(banyan).height;
  it('each level carries the fig parts its cut allows; past the cut hanging roots are curtains, far off nothing thin', () => {
    const near = figTris(banyan, {}), l1 = figTris(banyan, { dCut: H / 180, sidesMax: 4, cell: H / 5, near: false }), l0 = figTris(banyan, { dCut: H / 60, sidesMax: 4, near: false, far: true });
    expect(near.length).toBeGreaterThan(l1.length); expect(l1.length).toBeGreaterThan(l0.length);
    const lad = ladder(banyan, H); const plain = ladder({ ...banyan, arch: { ...banyan.arch, fig: undefined } }, H);
    for (const l of ['L3', 'L2', 'L1']) expect(lad[l].length).toBeGreaterThan(plain[l].length);
  });
  it('a strangler stands on its lattice, a rubber fig on its buttresses', () => {
    const s = grow(FIGS.strangler, { years: 16, seed: 4 }); expect(figTris(s, {}).length).toBeGreaterThan(figTris(s, { near: false }).length);
    const r = grow(FIGS.rubberfig, { years: 14, seed: 4 }); expect(figTris(r, {}).length).toBeGreaterThan(0);
  });
  it('the biggest buttress faces away from the crown’s lean', () => {
    const tris = buttressTris([0, 0, 0], 0.4, 2, { n: 6, lean: [3, 0], seed: 1 });
    const per = tris.length / 6; let best = -1, bestZ = -1;
    for (let k = 0; k < 6; k++) { const z = Math.max(...tris.slice(k * per, (k + 1) * per).flatMap((t) => t.p.map((p) => p[2]))); if (z > bestZ) { bestZ = z; best = k; } }
    const cx = tris.slice(best * per, (best + 1) * per).flatMap((t) => t.p.map((p) => p[0])).reduce((a, b) => a + b, 0);
    expect(cx).toBeLessThan(0);
  });
});

describe('fig species', () => {
  it('pool a fig like any tree, the same bytes twice', () => {
    const a = plantPool({ species: 'rubberfig', variants: 1, seed: 't', maxLevel: 'L1' }); const b = plantPool({ species: 'rubberfig', variants: 1, seed: 't', maxLevel: 'L1' });
    expect(a.kind).toBe('tree'); expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('a painted landscape may name them', () => {
    for (const sp of ['banyan', 'strangler', 'rubberfig']) {
      expect(validatePaintedLandscape({ plants: sp }).filter((e) => /plants/.test(e))).toEqual([]);
      expect(resolveLandscapePlants(sp).canopy).toBe(sp);
    }
  });
});

describe('terrain: figs are opt-in', () => {
  const field = (climate) => ({ K: { zones: { tree: 3300, snow: 4900 }, seaLevel: null }, atlas: { climate } });
  it('absent, a tropical world grows what it grew', () => {
    expect(JSON.stringify(plantsConfig(field('tropical'), { figs: false }))).toBe(JSON.stringify(plantsConfig(field('tropical'))));
  });
  it('with figs, the tropical lowland adds the three figs; other climates are unchanged', () => {
    const names = plantsConfig(field('tropical'), { figs: true }).species.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['banyan', 'strangler', 'rubberfig']));
    expect(JSON.stringify(plantsConfig(field('temperate'), { figs: true }))).toBe(JSON.stringify(plantsConfig(field('temperate'))));
  });
  it('on a tropical volcano the figs stand sparse in the lowland forest, about a hectare apart', () => {
    const f = atlasField({ world: { features: [{ feature: 'volcano' }], climate: 'tropical', seed: 'kinabalu' } }), S = f.atlas.span;
    const V = plantsConfig(f, { figs: true }), P = plantsKernel(f, V); const figs = new Set(['banyan', 'strangler', 'rubberfig']);
    let a = 7; const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let ha = 0, n = 0, zMax = 0;
    for (let k = 0; k < 4000 && ha < 40; k++) {
      const X = (rnd() - 0.5) * 0.6 * S, Y = (rnd() - 0.5) * 0.6 * S, st = P.standAt(X, Y); if (!st.ok || st.canopy < 0.3) continue; ha++;
      const arr = P.plantsIn(X - 50, Y - 50, 100); for (let i = 0; i < arr.length; i += PER) if (figs.has(V.species[arr[i + 4]].name)) { n++; zMax = Math.max(zMax, arr[i + 2]); }
    }
    expect(n / ha).toBeGreaterThan(0.4); expect(n / ha).toBeLessThan(3); expect(zMax).toBeLessThan(1800);
  });
  it('validation teaches', () => {
    expect(validateTerrainPlants({ figs: 'yes' }, { world: {} })[0]).toMatch(/figs must be true or false/);
    expect(validateTerrainPlants({ figs: true }, { world: {} })).toEqual([]);
  });
});
