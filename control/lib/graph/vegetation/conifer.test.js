/**
 * vegetation — the conifers grown by rule (conifer.js, conifer-mesh.js). Claims under test: growth is deterministic;
 * spruce and fir are narrow cones widest low, the pine's crown sits in its top half; a closed stand lifts the pine's
 * crown to its top half or less and keeps the shade-tolerant spruce and fir deep; the fir flattens at the top with age
 * (its old top whorls keep widening); a pine's needles are only on its outer years, so its limbs are bare inside; the far
 * levels come from the crown's envelope, each far cheaper than the one above, the spire a single cone narrowing upward;
 * the pool is a tree pool at unit height wearing its barks (a pine two: plated low, orange above), deterministic.
 */
import { describe, expect, it } from 'vitest';

import { growConifer, CONIFERS } from './conifer.js';
import { coniferLadder, needleTris, crownEnvelope, spireTris } from './conifer-mesh.js';
import { plantPool } from './pool.js';
import { SPECIES } from './species.js';
import { BARKS } from './bark.js';

const live = (p) => p.nodes.filter((n) => !n.died);
/** Crown diameter over height, from the widest band's p90 radius; the band it peaks in (0 = lowest tenth). */
function crownShape(p) {
  const H = p.H; const leafy = live(p).filter((n) => n.leaves > 0); const w = [];
  for (let b = 0; b < 10; b++) { const rs = leafy.filter((n) => n.pos[2] >= (b / 10) * H && n.pos[2] < ((b + 1) / 10) * H).map((n) => Math.hypot(n.pos[0], n.pos[1])).sort((x, y) => x - y); w.push(rs.length ? rs[Math.floor(0.9 * (rs.length - 1))] : 0); }
  const wmax = Math.max(...w); const base = Math.min(...leafy.filter((n) => n.order > 0).map((n) => n.pos[2]));
  return { DH: (2 * wmax) / H, widest: w.indexOf(wmax), w, crownRatio: (H - base) / H };
}

describe('the grower', () => {
  it('is deterministic in its seed', () => {
    for (const sp of Object.keys(CONIFERS)) {
      const a = growConifer(sp, { seed: 4 }), b = growConifer(sp, { seed: 4 });
      expect(JSON.stringify(a.nodes)).toBe(JSON.stringify(b.nodes));
      expect(JSON.stringify(growConifer(sp, { seed: 5 }).nodes)).not.toBe(JSON.stringify(a.nodes));
    }
  });
  it('grows spruce and fir as narrow cones widest low, and the pine a crown in its top half', () => {
    for (const seed of [3, 11, 29]) {
      const sp = crownShape(growConifer('spruce', { seed })), fi = crownShape(growConifer('silverfir', { seed })), pi = crownShape(growConifer('pine', { seed }));
      expect(sp.DH).toBeLessThan(0.3); expect(sp.widest).toBeLessThanOrEqual(2); expect(sp.w[9]).toBeLessThan(0.3 * sp.w[sp.widest]);
      expect(fi.DH).toBeLessThan(0.45); expect(fi.widest).toBeLessThanOrEqual(3);
      expect(pi.widest).toBeGreaterThanOrEqual(5); expect(pi.crownRatio).toBeLessThan(0.55);
    }
  });
  it('lifts the light-demanding pine in a stand, and keeps the shade-tolerant crowns deep', () => {
    expect(crownShape(growConifer('pine', { seed: 3, stand: 1 })).crownRatio).toBeLessThanOrEqual(0.5);
    for (const sp of ['spruce', 'silverfir']) {
      expect(crownShape(growConifer(sp, { seed: 3, stand: 1 })).crownRatio).toBeGreaterThanOrEqual(0.6);
      expect(crownShape(growConifer(sp, { seed: 3 })).crownRatio).toBeGreaterThan(0.85);
    }
  });
  it('flattens an old fir at the top: its leader slows and the top whorls widen', () => {
    const young = crownShape(growConifer('silverfir', { seed: 3, years: 30 })), old = crownShape(growConifer('silverfir', { seed: 3, years: 70 }));
    expect(old.w[9] / Math.max(...old.w)).toBeGreaterThan(young.w[9] / Math.max(...young.w));
  });
  it("clothes a pine's limbs only at their outer years", () => {
    const p = growConifer('pine', { seed: 3 }); const limbs = live(p).filter((n) => n.order === 1);
    expect(limbs.filter((n) => n.leaves > 0).length / limbs.length).toBeLessThan(0.3);
    const s = growConifer('spruce', { seed: 3 }); const twigs = live(s).filter((n) => n.order === 2);
    expect(twigs.filter((n) => n.leaves > 0).length / twigs.length).toBeGreaterThan(0.6);
  });
});

describe('what it wears', () => {
  const spruce = growConifer('spruce', { seed: 3 });
  it('draws needles as shoots, and volume widens the brush at the same face count', () => {
    const a = needleTris(spruce, 'spruce'), b = needleTris(spruce, 'spruce', { volume: 2 });
    expect(a.length).toBeGreaterThan(1000); expect(b.length).toBeLessThan(a.length); expect(b.length).toBeGreaterThan(0.4 * a.length);
    const width = (ts) => ts.reduce((s, t) => s + Math.hypot(t.p[2][0] - t.p[0][0], t.p[2][1] - t.p[0][1], t.p[2][2] - t.p[0][2]), 0) / ts.length;
    expect(width(b)).toBeGreaterThan(1.6 * width(a));
  });
  it('builds far levels from the crown envelope: each far cheaper, the spire one cone narrowing upward', () => {
    const lad = coniferLadder(spruce, 'spruce');
    expect(lad.L2.length).toBeLessThan(lad.L3.length); expect(lad.L1.length).toBeLessThan(lad.L2.length / 10); expect(lad.L0.length).toBeLessThan(lad.L1.length);
    expect(lad.L0.length).toBeLessThan(200);
    const E = crownEnvelope(spruce, 5); for (let b = 1; b < 5; b++) expect(E.r[b]).toBeLessThanOrEqual(E.r[b - 1] * 1.05);
    expect(spireTris(spruce, 'spruce').every((t) => t.p.every((q) => q[2] <= spruce.H * 1.03))).toBe(true);
  });
});

describe('the pool', () => {
  it('is a tree pool of unit height wearing its barks, deterministic', () => {
    for (const sp of ['spruce', 'silverfir', 'pine']) expect(SPECIES[sp].kind).toBe('conifer');
    const pool = plantPool({ species: 'pine', variants: 2, seed: 't', maxLevel: 'L2' });
    expect(pool.kind).toBe('tree'); expect(pool.variants).toHaveLength(2);
    expect(Object.keys(pool.textures).sort()).toEqual(['bark-pine', 'bark-pineUpper']);
    for (const v of pool.variants) {
      expect(v.height).toBe(1);
      const zMax = Math.max(...v.levels.L2.flatMap((f) => f.corners.map((c) => c[2]))); expect(zMax).toBeGreaterThan(0.95); expect(zMax).toBeLessThan(1.1);
      expect(v.levels.L2.some((f) => f.texture === 'bark-pineUpper')).toBe(true);
    }
    expect(JSON.stringify(plantPool({ species: 'pine', variants: 2, seed: 't', maxLevel: 'L2' }))).toBe(JSON.stringify(pool));
    expect(BARKS.spruce && BARKS.silverfir && BARKS.pineUpper).toBeTruthy();
  });
});
