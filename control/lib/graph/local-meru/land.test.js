/**
 * The sixth-gen land's four opt-in words on a local meru: `ground` (a terrain world's field under the plain) and the
 * shading's `mix` (surfaces mixed per corner), `facet` (rock drawn into planes) and `valley` (the sky a hollow loses).
 * Each is absent unless asked; each is checked on the concept, on one small island or one synthetic grid.
 */
import { describe, expect, it } from 'vitest';

import { readLocalMeru } from './plan.js';
import { readGround } from './ground.js';
import { valleyOf } from './scene.js';
import { assembleStageScene } from '../era/stage.js';
import { readGeocube, lowerGeocube } from '../era/geocube.js';

const TWO_BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }, { form: 'mound', height: 5, foot: 4.8, summit: 2.2, up: { turns: 1 } }];
const ISLE = { geology: true, walk: 'base' };
const build = (meru) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: TWO_BASES, island: ISLE, ...meru } }, {});
const base = build({ shading: true });
const of = (p, ...gs) => p.faces.filter((f) => gs.includes(f.group));
const key = (c) => `${Math.round(c[0] * 100)},${Math.round(c[1] * 100)}`;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => rgb(h).reduce((a, v) => a + v, 0) / 765;
const ROCKY = { heartbeat: 'rocky-irregular', splatch: 'verdure-trio', seed: 'g2' };

describe('the land: reading the words', () => {
  it('reads ground, mix, facet and valley, and refuses bad ones', () => {
    expect(readLocalMeru({ shading: true }).shading).toMatchObject({ mix: 0, facet: 0, valley: 0 });
    expect(() => readLocalMeru({ shading: { mix: 9 } })).toThrow(/shading.mix is metres/);
    expect(() => readLocalMeru({ shading: { facet: -1 } })).toThrow(/shading.facet is metres/);
    expect(() => readLocalMeru({ shading: { valley: 2 } })).toThrow(/shading.valley is 0..1/);
    expect(readGround({ from: ROCKY })).toMatchObject({ span: 120, height: 3, at: null });
    expect(readLocalMeru({}).ground).toBeUndefined();
    expect(() => readGround({ from: ROCKY, span: 5 })).toThrow(/ground.span is the metres/);
    expect(() => readGround({ from: ROCKY, height: 0 })).toThrow(/ground.height is metres/);
    expect(() => readGround({ from: ROCKY, tilt: 1 })).toThrow(/ground.tilt is not a setting/);
    expect(() => readGround({ span: 60 })).toThrow(/ground: .*from must be a painted-landscape recipe/);
  });
  it('carries them through a geocube: land words in its land, ground on its outside or a terrain', () => {
    const o = readGeocube('valley-morning').outside;
    const cube = readGeocube({ from: 'valley-morning', outside: { ...o, land: { ...o.land, mix: 1, facet: 4, valley: 0.7 }, ground: { from: ROCKY, span: 45 }, terrains: { flat: { ground: false } } } });
    const low = lowerGeocube(cube, 'outside');
    expect(low.meru.shading).toMatchObject({ mix: 1, facet: 4, valley: 0.7 });
    expect(low.meru.ground).toMatchObject({ span: 45 });
    expect(lowerGeocube(cube, 'outside', 'flat').meru).not.toHaveProperty('ground');
    expect(lowerGeocube(readGeocube('valley-morning'), 'outside').meru).not.toHaveProperty('ground');
    expect(() => readGeocube({ from: 'valley-morning', outside: { ...o, land: { ...o.land, glow: 1 } } })).toThrow(/outside.land.glow is not a setting/);
    expect(() => readGeocube({ from: 'valley-morning', outside: { ...o, ground: { from: ROCKY, span: 5 } } })).toThrow(/geocube: outside.ground.span is the metres/);
  });
});

describe('the land: ground, a terrain world under the plain', () => {
  const grounded = build({ shading: true, ground: { from: ROCKY, span: 45, height: 3.5 } });
  it('lifts the plain by the terrain, never sinks it, and leaves the seam where the walker starts', () => {
    const at = new Map(of(base, 'isekai:ground').flatMap((f) => f.corners.filter((c) => c[2] < 0.3).map((c) => [key(c), c[2]])));
    const d = of(grounded, 'isekai:ground').flatMap((f) => f.corners).filter((c) => at.has(key(c))).map((c) => c[2] - at.get(key(c)));
    expect(d.filter((v) => v > 0.5).length).toBeGreaterThan(200);
    expect(Math.min(...d)).toBeGreaterThan(-1e-9);
    expect(Math.max(...d)).toBeLessThanOrEqual(3.5 + 1e-9);
    expect(grounded.walk.spawn).toEqual(base.walk.spawn);
    expect(grounded.localMeru.ground).toEqual({ heartbeat: 'rocky-irregular', span: 45, height: 3.5 });
  });
  it('keeps the geology to the raised land: the terrain\'s hills are ground, not a new mountain of rock', () => {
    expect(of(grounded, 'isekai:cliff').length).toBeLessThan(of(base, 'isekai:cliff').length * 1.5);
  });
});

describe('the land: mix, facet and valley', () => {
  it('mixes the surfaces across a seam: the same corner reads nearly the same from the grass and from the rock', () => {
    const seam = (p) => {
      const g = new Map(), gaps = [];
      for (const f of of(p, 'isekai:ground')) f.corners.forEach((c, k) => g.set(key(c) + c[2].toFixed(2), f.cornerFills[k]));
      for (const f of of(p, 'isekai:cliff')) f.corners.forEach((c, k) => { const h = g.get(key(c) + c[2].toFixed(2)); if (h) gaps.push(rgb(h).reduce((a, v, j) => a + Math.abs(v - rgb(f.cornerFills[k])[j]), 0)); });
      return gaps.reduce((a, v) => a + v, 0) / gaps.length;
    };
    const mixed = build({ shading: { mix: 1 } });
    // the geometry is the land's own: only colour moves
    expect(of(mixed, 'isekai:ground').map((f) => f.corners)).toEqual(of(base, 'isekai:ground').map((f) => f.corners));
    // the colour's gap closes; what is left is light (rock lit per facet, grass per corner), not the surfaces
    expect(seam(mixed)).toBeLessThan(seam(base) * 0.7);
  });

  it('draws the rock into planes: neighbouring rock quads turn less against each other, and the grass seam stays', () => {
    const faceted = build({ shading: { facet: 4 } });
    const turn = (p) => {
      const edges = new Map(); let s = 0, n = 0;
      for (const f of of(p, 'isekai:cliff')) {
        const ks = f.corners.map((c) => c.map((v) => Math.round(v * 100)).join(','));
        ks.forEach((a, i) => { const b = ks[(i + 1) % ks.length], e = a < b ? `${a}|${b}` : `${b}|${a}`, o = edges.get(e); if (o) { s += 1 - (o[0] * f.normal[0] + o[1] * f.normal[1] + o[2] * f.normal[2]); n++; } else edges.set(e, f.normal); });
      }
      return s / n;
    };
    expect(turn(faceted)).toBeLessThan(turn(base) * 0.75);
    // a corner the grass shares is not moved: every corner of the plain is where it was (a rock quad planed gentle
    // enough turns grass, so the plain may gain a few)
    const flat = (p) => new Set(of(p, 'isekai:ground').flatMap((f) => f.corners).filter((c) => c[2] < 0.3).map((c) => c.join()));
    const after = flat(faceted);
    expect([...flat(base)].every((c) => after.has(c))).toBe(true);
  });

  it('reads the valley over the slope\'s own grade: none on a plain or an even slope, most down a gully', () => {
    const grid = (f) => { const g = { x0: -30, y0: -30, dx: 0.5, nx: 121, ny: 121 }; g.z = new Float64Array(g.nx * g.ny); for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) g.z[j * g.nx + i] = f(g.x0 + i * 0.5, i + j); return g; };
    const at = (f, x) => valleyOf(grid(f)).at([x, 0, f(x, 0)]);
    expect(at(() => 0, 0)).toBe(0);
    expect(at((x) => x * 0.577, 0)).toBeCloseTo(0, 6);
    expect(at((x, k) => x * 0.577 + (k % 2 ? 0.25 : -0.25), 0)).toBeLessThan(0.01);   // the rock's jags are crevice's
    const foot = at((x) => Math.max(0, x), -5), gully = at((x) => Math.abs(x) * 0.7, 0);
    expect(foot).toBeGreaterThan(0.1);
    expect(gully).toBeGreaterThan(foot);
    expect(valleyOf(grid(() => 0)).at([0, 0, 2])).toBeNull();   // off the ground: a boulder's top
  });

  it('only darkens: no corner of the land is lighter for the valley', () => {
    const dark = build({ shading: { valley: 0.7 } });
    const L = (p) => of(p, 'isekai:ground', 'isekai:cliff', 'isekai:sand').flatMap((f) => f.cornerFills.map(lum));
    const a = L(base), b = L(dark);
    expect(b.every((v, i) => v <= a[i] + 1 / 255)).toBe(true);
    expect(b.filter((v, i) => v < a[i] - 0.02).length).toBeGreaterThan(100);
  });
});
