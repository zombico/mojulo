// hair-spine.test.js — the lock's spine law: the grass elastica grown from a scalp root. Length true at every B and in
// every wind, the textbook small-B deflection, the stable branch past the buckling load (never upright, never looped),
// the planar solve in any root direction, and the spine words.
import { describe, it, expect } from 'vitest';
import { stableElastica, lockSpine, lockB, spineAt, spineLoad, drapeSpine, validateSpine, resolveSpine, spineFor, coilOffsets, coilSpine, coilSteps, SPINE_STIFFNESS, SPINE_REGIONS, B_REF_L } from './hair-spine.js';

const arc = (pts) => pts.slice(1).reduce((a, q, i) => a + Math.hypot(...q.map((v, k) => v - pts[i][k])), 0);
const tip = (pts) => pts[pts.length - 1];
/** the largest turn of the tangent between neighbours, radians: a loop turns through more than π overall */
const totalTurn = (pts) => { let t = 0; for (let i = 2; i < pts.length; i++) { const a = Math.atan2(pts[i - 1][1] - pts[i - 2][1], pts[i - 1][0] - pts[i - 2][0]), b = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]); let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; t += Math.abs(d); } return t; };

describe('the planar elastica', () => {
  it('is exactly its length at every B and root angle', () => {
    for (const B of [0, 0.5, 3, 20, 100, 400]) for (const deg of [-80, -45, 0, 30, 80, 90]) expect(arc(stableElastica(B, deg * Math.PI / 180))).toBeCloseTo(1, 6);
  });
  it('a horizontal root at small B deflects the textbook B/8', () => {
    for (const B of [0.01, 0.05]) expect(-tip(stableElastica(B, 0))[1]).toBeCloseTo(B / 8, 4);
  });
  it('past the buckling load a near-upright root droops instead of standing, and a hanging root never loops', () => {
    for (const B of [20, 100, 400]) {
      expect(tip(stableElastica(B, 80 * Math.PI / 180))[1]).toBeLessThan(0.5);   // the bare bisection returns ~0.98 at B 100
      for (const deg of [-45, 0, 30, 80]) expect(totalTurn(stableElastica(B, deg * Math.PI / 180))).toBeLessThan(Math.PI);
    }
  });
  it('more B droops further: the tip falls monotonically', () => {
    let prev = Infinity;
    for (const B of [0.2, 1, 3, 8, 20, 60]) { const y = tip(stableElastica(B, 0.3))[1]; expect(y).toBeLessThan(prev); prev = y; }
  });
  it('is deterministic', () => expect(stableElastica(37, 0.7)).toEqual(stableElastica(37, 0.7)));
});

describe('the lock in space', () => {
  const root = [0.05, 0.02, 0.1];
  it('keeps its length in any aim, with a held root and in wind', () => {
    for (const aim of [[1, 0, 0], [0, -1, 0.3], [0, 0, 1], [0, 0, -1], [0.3, 0.4, -0.8]]) for (const hold of [0, 0.2]) for (const wind of [null, { R: 1.5, dir: 30 }]) {
      const s = lockSpine({ root, aim, L: 0.25, B: 30, hold, wind });
      expect(s).toHaveLength(17); expect(s[0]).toEqual(root);
      expect(Math.abs(arc(s) / 0.25 - 1)).toBeLessThan(0.01);   // re-sampled at 16 for the caller: the chords of a curve run a hair short of its arc
      for (const p of s) expect(p.every(Number.isFinite)).toBe(true);
    }
  });
  it('stays in the plane of the load and the aim', () => {
    const s = lockSpine({ root: [0, 0, 0], aim: [1, 0, 0.5], L: 0.3, B: 20 });
    for (const p of s) expect(Math.abs(p[1])).toBeLessThan(1e-12);
  });
  it('a held root runs straight along the aim', () => {
    const s = lockSpine({ root: [0, 0, 0], aim: [0, 1, 0], L: 0.2, B: 50, hold: 0.25 });
    for (const p of s.slice(0, 5)) { expect(p[0]).toBe(0); expect(p[2]).toBeCloseTo(0, 12); }
  });
  it('wind carries the tip downwind and lifts it; gravity alone hangs it', () => {
    const still = tip(lockSpine({ root: [0, 0, 0], aim: [0, 0, -1], L: 0.3, B: 40 }));
    expect(still[2]).toBeCloseTo(-0.3, 6);
    const blown = tip(lockSpine({ root: [0, 0, 0], aim: [0, 0, -1], L: 0.3, B: 40, wind: { R: 2, dir: 0 } }));   // from the face toward the back
    expect(blown[1]).toBeLessThan(-0.15); expect(blown[2]).toBeGreaterThan(still[2] + 0.1);
    const side = tip(lockSpine({ root: [0, 0, 0], aim: [0, 0, -1], L: 0.3, B: 40, wind: { R: 2, dir: 90 } }));
    expect(side[0]).toBeGreaterThan(0.15);
    expect(spineLoad({ R: 0 })).toEqual({ down: [0, 0, -1], m: 1 });
  });
  it('spineAt reads equal-arc samples', () => {
    const s = lockSpine({ root: [0, 0, 0], aim: [1, 0, 0], L: 0.2, B: 0 });
    expect(spineAt(s, 0.5)[0]).toBeCloseTo(0.1, 12); expect(spineAt(s, 1)).toEqual(tip(s)); expect(spineAt(s, 0)).toEqual(s[0]);
  });
});

describe('the drape', () => {
  const head = { c: [0, 0, 0], r: [0.08, 0.1, 0.11] }, neck = { axis: [0, -0.02], r: 0.05, top: -0.04, bottom: -0.4 };
  const inside = (p) => (p[0] / 0.08) ** 2 + (p[1] / 0.1) ** 2 + (p[2] / 0.11) ** 2 < 1;
  it('a lock blown across the head wraps it, stays its length and never enters it', () => {
    const blown = lockSpine({ root: [-0.08, 0, 0.02], aim: [0, 0, -1], L: 0.25, B: 30, wind: { R: 2, dir: 90 } });
    expect(blown.some(inside) || blown.some((p) => p[2] < -0.04 && Math.hypot(p[0], p[1] + 0.02) < 0.05)).toBe(true);   // the bare spine passes through
    const d = drapeSpine(blown, [head, neck]);
    expect(d.slice(1).some(inside)).toBe(false);
    for (const p of d.filter((q) => q[2] < -0.04 && q[2] > -0.4)) expect(Math.hypot(p[0], p[1] + 0.02)).toBeGreaterThan(0.0499);
    expect(Math.abs(arc(d) - arc(blown))).toBeLessThan(1e-9);
  });
  it('a lock that never enters is returned as it was', () => {
    const s = lockSpine({ root: [0.09, 0, 0.02], aim: [0.2, 0, -1], L: 0.2, B: 30 });
    expect(drapeSpine(s, [head])).toBe(s);
  });
});

describe('the words', () => {
  it('stiffness: a word or a number at the reference length, scaled by L³', () => {
    expect(lockB('soft', B_REF_L)).toBe(SPINE_STIFFNESS.soft); expect(lockB(10, B_REF_L / 2)).toBeCloseTo(10 / 8, 12);
    expect(SPINE_STIFFNESS.stiff).toBeLessThan(SPINE_STIFFNESS.springy); expect(SPINE_STIFFNESS.soft).toBeLessThan(SPINE_STIFFNESS.limp);
  });
  it('validates and resolves', () => {
    expect(validateSpine('elastica')).toEqual([]);
    expect(validateSpine({ stiffness: 'limp', hold: 0.2, wind: { R: 1, dir: 45 } })).toEqual([]);
    expect(validateSpine({ stiffness: 12 })).toEqual([]);
    expect(validateSpine('bezier')[0]).toMatch(/'elastica' or/);
    expect(validateSpine({ stiffness: 'floppy' })[0]).toMatch(/stiffness/);
    expect(validateSpine({ hold: 0.9 })[0]).toMatch(/hold/);
    expect(validateSpine({ wind: { R: -1 } })[0]).toMatch(/wind/);
    expect(validateSpine({ gravity: 2 })[0]).toMatch(/unknown/);
    expect(resolveSpine('elastica')).toEqual({ law: 'elastica' });
    expect(resolveSpine({ stiffness: 'stiff' })).toEqual({ law: 'elastica', stiffness: 'stiff' });
  });
});

describe('regions, clumps and curl', () => {
  it('validates the words by name', () => {
    expect(validateSpine({ regions: { front: { stiffness: 'stiff', length: 0.7 }, tail: { curl: { radius: 0.02, turns: 4 } } }, locks: { 'fringe-3': { stiffness: 'limp' } }, curl: { radius: 0.01, turns: 2, hand: -1, from: 0.3 } })).toEqual([]);
    expect(validateSpine({ regions: { top: {} } })[0]).toMatch(/regions\.top: not a region/);
    expect(validateSpine({ regions: { back: { length: 4 } } })[0]).toMatch(/regions\.back\.length/);
    expect(validateSpine({ locks: { 'back-2': { length: 1.2 } } })[0]).toMatch(/locks\.back-2\.length: unknown/);
    expect(validateSpine({ curl: { radius: 0.2, turns: 2 } })[0]).toMatch(/curl\.radius/);
    expect(validateSpine({ curl: { radius: 0.01, turns: 2, hand: 0 } })[0]).toMatch(/curl\.hand/);
    expect(SPINE_REGIONS).toEqual(['front', 'sides', 'back', 'crown', 'tail']);
  });
  it('the most specific word wins: a clump over its region over the head; curl false stops one', () => {
    const S = { stiffness: 'soft', curl: { radius: 0.01, turns: 2 }, regions: { back: { stiffness: 'limp', length: 1.3 } }, locks: { 'back-2': { stiffness: 'stiff', curl: false } } };
    expect(spineFor(S, 'front')).toMatchObject({ stiffness: 'soft', length: 1, curl: { radius: 0.01, turns: 2 } });
    expect(spineFor(S, 'back')).toMatchObject({ stiffness: 'limp', length: 1.3 });
    expect(spineFor(S, 'back', 'back-2')).toMatchObject({ stiffness: 'stiff', curl: null, length: 1.3 });
    expect(spineFor({ curl: { radius: 0, turns: 3 } }, 'front').curl).toBeNull();
  });
  it('a coil winds about its axis at its radius, starts on the axis, and leaves the axis where it falls', () => {
    const line = Array.from({ length: 41 }, (_, i) => [0, 0, -0.3 * i / 40]);
    const { offsets } = coilOffsets(line, { radius: 0.02, turns: 4 }, 0.3, [1, 0, 0]);
    expect(Math.hypot(...offsets[0])).toBe(0);
    const coiled = coilSpine(line, { radius: 0.02, turns: 4 }, 0.3, [1, 0, 0]);
    for (const p of coiled.slice(8)) expect(Math.hypot(p[0] - 0.02, p[1])).toBeCloseTo(0.02, 6);   // on a circle of the radius about the coil's axis
    expect(coiled.at(-1)[2]).toBeCloseTo(-0.3, 12);   // where it falls is unchanged
    expect(coilSpine(line, null, 0.3)).toBe(line);
    expect(coilSteps({ turns: 4 }, 6)).toBe(36); expect(coilSteps(null, 6)).toBe(6);
  });
  it('a planar coil waves in one plane', () => {
    const line = Array.from({ length: 41 }, (_, i) => [0, 0, -0.3 * i / 40]);
    for (const o of coilOffsets(line, { radius: 0.02, turns: 3 }, 0.3, [1, 0, 0], true).offsets) expect(Math.abs(o[1])).toBeLessThan(1e-12);
  });
});


describe('a curl\'s keratin twist', () => {
  const line = Array.from({ length: 81 }, (_, i) => [0, 0, -i * 0.002]), L = 0.16;
  const base = { radius: 0.004, turns: 6, from: 0.02 };
  it('absent, the coil as it was; a flip turns the hand back past its place and not before', () => {
    expect(coilOffsets(line, { ...base, flips: [], taper: 0 }, L).offsets).toEqual(coilOffsets(line, base, L).offsets);
    const plain = coilOffsets(line, base, L).offsets, flipped = coilOffsets(line, { ...base, flips: [0.5] }, L).offsets;
    for (let i = 0; i <= 40; i++) expect(flipped[i][0]).toBeCloseTo(plain[i][0], 12);
    expect(flipped.slice(50).some((p, k) => Math.abs(p[1] - plain[50 + k][1]) > 1e-4)).toBe(true);
  });
  it('the taper draws the coil in toward the root, the tip as wide', () => {
    const { offsets } = coilOffsets(line, { ...base, taper: 0.4 }, L), wide = coilOffsets(line, base, L).offsets;
    const reach = (os, a, b) => Math.max(...os.slice(a, b).map((o) => Math.hypot(o[0], o[1])));
    expect(reach(offsets, 10, 30)).toBeLessThan(reach(wide, 10, 30));
    expect(reach(offsets, 70, 81)).toBeCloseTo(reach(wide, 70, 81), 3);
  });
});
