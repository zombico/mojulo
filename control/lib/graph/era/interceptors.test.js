import { describe, it, expect } from 'vitest';
import { readInterceptors, INTERCEPTOR_IDS, floorCells } from './interceptors.js';
import { assembleStageScene, planStage } from './stage.js';
import { rollArt, compileArt } from './art-direction.js';
import { walkLine } from './dirt.js';
import { starter } from './entries.js';

// immersive detail that never collides: litter, cracks, grass, vines, creeping ivy, fungi (era/interceptors.js)
const M = { ...starter('gothic-stone'), reference: 'gothic-night' };
const GROUP = { litter: 'stage:litter', cracks: 'stage:crack', grass: 'stage:grass', vines: 'stage:vine', creep: 'stage:creep', fungus: 'stage:fungus' };
const built = new Map();
const scene = (o = {}) => { const k = JSON.stringify(o); return built.get(k) || built.set(k, assembleStageScene({ ...M, ...o })).get(k); };
const grownOf = (p) => p.faces.filter((f) => Object.values(GROUP).includes(f.group));
const recipe = (k, v) => (k === 'litter' || k === 'cracks' ? { [k]: v } : { growth: { [k]: v } });

describe('interceptors', () => {
  it('read a number for every plant, or plant by plant, with litter and cracks; and say what is wrong', () => {
    expect(readInterceptors({ growth: 0.5 })).toEqual({ grass: 0.5, vines: 0.5, creep: 0.5, fungus: 0.5 });
    expect(readInterceptors({ growth: { vines: 1 }, cracks: 0.2 })).toEqual({ vines: 1, cracks: 0.2 });
    expect(readInterceptors({ growth: 0, litter: 0 })).toBe(null);
    expect(readInterceptors({})).toBe(null);
    expect(() => readInterceptors({ growth: 2 })).toThrow(/0 \(none\) to 1/);
    expect(() => readInterceptors({ growth: { moss: 1 } })).toThrow(/not a growth/);
  });

  it.each(INTERCEPTOR_IDS)('%s grows in its own group, more the more aggressive, and none at 0', (k) => {
    expect(grownOf(scene(recipe(k, 0)))).toEqual([]);
    const lo = scene(recipe(k, 0.3)).faces.filter((f) => f.group === GROUP[k]).length, hi = scene(recipe(k, 1)).faces.filter((f) => f.group === GROUP[k]).length;
    expect(hi).toBeGreaterThan(0);
    expect(hi).toBeGreaterThanOrEqual(lo);
    expect(grownOf(scene(recipe(k, 1))).every((f) => f.group === GROUP[k])).toBe(true);
  });

  it('never collides and is never named: the colliders and anchors are the same with every interceptor at full', () => {
    const bare = scene(), full = scene({ growth: 1, litter: 1, cracks: 1 });
    expect(full.colliders).toEqual(bare.colliders);
    expect(full.anchors).toEqual(bare.anchors);
    expect(grownOf(full).some((f) => f.node)).toBe(false);
    expect(grownOf(full).length).toBeGreaterThan(500);
  });

  it('grows the same way every time, lays each crack on one stone, and cuts the litter from the floor\'s shade', () => {
    const p = scene({ growth: 1, litter: 1, cracks: 1 });
    expect(assembleStageScene({ ...M, growth: 1, litter: 1, cracks: 1 }).faces).toEqual(p.faces);
    const cells = floorCells(planStage(M));
    for (const f of p.faces.filter((q) => q.group === 'stage:crack')) {
      const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
      expect(cells.some((c) => Math.min(...xs) >= c.x0 && Math.max(...xs) <= c.x1 && Math.min(...ys) >= c.y0 && Math.max(...ys) <= c.y1)).toBe(true);
    }
    // litter is cut from the floor's own shade: each piece's tint within a tenth of the floor's
    const tint = planStage(M).kit.tint.floor, raw = assembleStageScene({ ...M, litter: 1 }, { unshaded: true }).faces.filter((f) => f.group === 'stage:litter');
    expect(raw.length).toBeGreaterThan(20);
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    for (const f of raw) hex(f.fill).forEach((v, k) => expect(Math.abs(v / tint[k] - 1)).toBeLessThan(0.12));
  });

  it('keeps the litter off the walk, and thins the grass toward it', () => {
    const p = scene({ growth: { grass: 1 }, litter: 1 }), W = walkLine(planStage(M));
    const toWalk = (x, y) => { let b = Infinity; for (let i = 0; i + 1 < W.length; i++) { const [ax, ay] = W[i], [bx, by] = W[i + 1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)); b = Math.min(b, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return b; };
    const mid = (f) => [f.corners.reduce((t, c) => t + c[0], 0) / f.corners.length, f.corners.reduce((t, c) => t + c[1], 0) / f.corners.length];
    const stones = p.faces.filter((q) => q.group === 'stage:litter' && !q.texture);
    for (const f of stones) expect(toWalk(...mid(f))).toBeGreaterThan(0.4);
    const tufts = p.faces.filter((q) => q.group === 'stage:grass').map(mid);
    expect(tufts.filter(([x, y]) => toWalk(x, y) < 0.6).length / tufts.length).toBeLessThan(0.15);
  });

  it('the art direction rolls the dials from dice of their own: an old seed keeps every other number', () => {
    const a = rollArt('gothic-stone', 7);
    expect(Object.keys(a.materials.weathering)).toEqual(['earth', 'ivy', 'growth', 'litter', 'cracks']);
    const old = { ...a, materials: { ...a.materials, weathering: { earth: a.materials.weathering.earth, ivy: a.materials.weathering.ivy } } };
    expect(compileArt(old, 'gothic-stone').intercept).toEqual({});
    expect(compileArt(a, 'gothic-stone').intercept.fungus).toBe(a.materials.weathering.growth);
    // a direction rolled before the dials existed builds as it did: no interceptor faces
    expect(grownOf(assembleStageScene({ ...M, art: old }))).toEqual([]);
  });
});
