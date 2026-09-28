/**
 * rock-fracture — a rock as a field shape (rock-formation.plan.md R2). Claims under test: the field is deterministic
 * per spec and is a recipe (moving the centre moves the rock, grains and all); the surface stays inside the declared
 * bounds; more octaves only remove material and only add faces; `octaves: 0` is the block, and `rockBlockFaces` is
 * that block as a closed convex polytope of a dozen-odd planes (the far level of detail); grain colour resolves on
 * a hand sample and falls to the modal mean past the grain size; the lattice shows where physics says it should
 * (an aligned slate's block planes follow its fabric, a random granite's do not); the shape mints through the
 * workbench fields path, keeps its colour under a domain op, and teaches on a bad spec.
 */
import { describe, expect, it } from 'vitest';

import { rockField, rockBlockFaces, validateRockSpec } from './rock-fracture.js';
import { fieldToFaces } from './field-faces.js';
import { validateFieldTerms, FIELD_SHAPE_KINDS } from './field-terms.js';
import { ROCK_PRESETS } from './rock-minerals.js';

const GRANITE = { size: 0.1, rock: 'granite', seed: 3, unit: 'm' };
const sampleLine = (f, n = 41) => [...Array(n)].map((_, i) => f.d([-0.06 + (0.12 * i) / (n - 1), 0.01, 0.005]));
const rockFaces = (shape, cells = 48, extra = []) => fieldToFaces({ terms: [{ op: 'add', shape: { kind: 'rock', center: [0, 0, 0], ...shape } }, ...extra], cells });

describe('the field', () => {
  it('is deterministic per spec, and a different seed is a different rock', () => {
    expect(sampleLine(rockField(GRANITE))).toEqual(sampleLine(rockField(GRANITE)));
    expect(sampleLine(rockField({ ...GRANITE, seed: 4 }))).not.toEqual(sampleLine(rockField(GRANITE)));
  });
  it('is a recipe in its own frame: moving the centre moves the whole rock', () => {
    const a = rockField(GRANITE), b = rockField({ ...GRANITE, center: [5, -2, 1] });
    for (const x of [-0.04, -0.01, 0.02, 0.045]) {
      expect(b.d([x + 5, -2.01, 1.003])).toBeCloseTo(a.d([x, -0.01, 0.003]), 12);
      expect(b.colorAt([x + 5, -2.01, 1.003], 0)).toBe(a.colorAt([x, -0.01, 0.003], 0));
    }
  });
  it('is inside its bounds: positive on the bounding box surface', () => {
    const f = rockField(GRANITE); const { min, max } = f.bounds;
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
      const u = i / 6, v = j / 6;
      for (const p of [[min[0], min[1] + u * (max[1] - min[1]), min[2] + v * (max[2] - min[2])], [min[0] + u * (max[0] - min[0]), max[1], min[2] + v * (max[2] - min[2])], [min[0] + u * (max[0] - min[0]), min[1] + v * (max[1] - min[1]), max[2]]]) expect(f.d(p)).toBeGreaterThan(-1e-12);
    }
  });
  it('the cuts hold OUTSIDE the base too, so an offset (round, shell) keeps the facets', () => {
    // a point just beyond a block plane but inside the base's outer band must see the plane, not the bare ellipsoid
    const f = rockField(GRANITE); const bare = rockField({ ...GRANITE, blockPlanes: 0, octaves: 0 });
    let raised = 0; const n = 400; const r = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 0.5;
    for (let i = 0; i < n; i++) { const p = [r(i, 1) * 0.14, r(i, 2) * 0.11, r(i, 3) * 0.09]; const e = bare.d(p);
      if (e > 0 && e < 0.02) { expect(f.d(p)).toBeGreaterThanOrEqual(e - 1e-12); if (f.d(p) > e + 0.002) raised++; } }
    expect(raised).toBeGreaterThan(20);
    // and a rounded rock is still faceted: many of its faces share a few normals (flat breaks), unlike a rounded ellipsoid
    const faces = rockFaces(GRANITE, 48, [{ op: 'round', radius: 0.003 }]);
    const key = (n) => n.map((x) => Math.round(x * 20)).join(','); const counts = new Map(); faces.forEach((x) => counts.set(key(x.outNormal), (counts.get(key(x.outNormal)) || 0) + 1));
    const top = [...counts.values()].sort((a, b) => b - a).slice(0, 13).reduce((s2, c) => s2 + c, 0);
    expect(top / faces.length).toBeGreaterThan(0.2);
  });
  it('octaves only remove material: d is monotone non-decreasing in octaves', () => {
    const lines = [0, 1, 2, 3, 4].map((k) => sampleLine(rockField({ ...GRANITE, octaves: k })));
    for (let k = 1; k < lines.length; k++) lines[k].forEach((d, i) => expect(d).toBeGreaterThanOrEqual(lines[k - 1][i] - 1e-12));
  });
});

describe('level of detail', () => {
  it('rockBlockFaces is a closed convex polytope of a dozen-odd planes', () => {
    const faces = rockBlockFaces(GRANITE);
    expect(faces.length).toBeGreaterThanOrEqual(8); expect(faces.length).toBeLessThanOrEqual(40);
    const key = (p) => p.map((x) => x.toFixed(9)).join(','); const edges = new Map();
    for (const f of faces) f.corners.forEach((c, i) => { const a = key(c), b = key(f.corners[(i + 1) % f.corners.length]); const k = a < b ? `${a}|${b}` : `${b}|${a}`; edges.set(k, (edges.get(k) || 0) + 1); });
    expect([...edges.values()].every((n) => n === 2)).toBe(true);                     // closed: every edge twice
    const verts = faces.flatMap((f) => f.corners);
    for (const f of faces) { const d0 = f.normal[0] * f.corners[0][0] + f.normal[1] * f.corners[0][1] + f.normal[2] * f.corners[0][2];
      for (const v of verts) expect(f.normal[0] * v[0] + f.normal[1] * v[1] + f.normal[2] * v[2]).toBeLessThanOrEqual(d0 + 1e-9); }   // convex
    expect(new Set(faces.map((f) => f.tint)).size).toBe(1);                            // one tint: the modal mean
  });
  it('octaves are detail: faces grow with octaves at a fixed grid', () => {
    const counts = [0, 2, 4].map((k) => rockFaces({ ...GRANITE, octaves: k }).length);
    expect(counts[1]).toBeGreaterThan(counts[0]); expect(counts[2]).toBeGreaterThan(counts[1]);
  });
});

describe('colour is the grain, filtered to the footprint', () => {
  it('a hand sample resolves grains; a mountain is the modal mean', () => {
    const hand = rockFaces(GRANITE, 48); const mountain = rockFaces({ ...GRANITE, size: 800 }, 48);
    const f = rockField(GRANITE);
    expect(f.colorAt([0.01, 0.01, 0.01], 1)).toBe(f.meanColor);                      // footprint ≫ grain → the mean
    expect(f.colorAt([0.01, 0.01, 0.01], 0)).not.toBe(f.meanColor);                  // a point → one grain
    // the hand sample's fills vary far more than the mountain's (whose variation is shading alone)
    expect(new Set(hand.map((x) => x.fill)).size).toBeGreaterThan(2 * new Set(mountain.map((x) => x.fill)).size);
  });
  it('color:false leaves the spec tint; a transform keeps the grain colour', () => {
    const plain = fieldToFaces({ terms: [{ op: 'add', shape: { kind: 'rock', center: [0, 0, 0], ...GRANITE, color: false } }], cells: 32, tint: '#808080' });
    const turned = rockFaces(GRANITE, 32, [{ op: 'transform', rotate: [0, 0, 30] }]);
    const raw = rockFaces(GRANITE, 32);
    expect(new Set(turned.map((x) => x.fill)).size).toBeGreaterThan(new Set(plain.map((x) => x.fill)).size * 2);
    expect(new Set(raw.map((x) => x.fill)).size).toBeGreaterThan(new Set(plain.map((x) => x.fill)).size * 2);
  });
});

describe('the lattice shows where physics says it should', () => {
  // block planes are the biggest breaks; in slate every grain's mica is aligned, so they follow the fabric
  const alignment = (rock) => {
    const faces = rockBlockFaces({ size: 1, rock, seed: 11, blockPlanes: 13, unit: 'm' });
    const f = ROCK_PRESETS.slate.fabric.normal; const fl = Math.hypot(...f);
    const near = faces.filter((x) => Math.abs(x.normal[0] * f[0] + x.normal[1] * f[1] + x.normal[2] * f[2]) / fl > Math.cos((15 * Math.PI) / 180));
    return near.length / faces.length;
  };
  it('slate breaks along its fabric; granite does not care', () => {
    expect(alignment('slate')).toBeGreaterThan(0.25);
    expect(alignment('granite')).toBeLessThan(alignment('slate'));
  });
});

describe('the workbench path', () => {
  it('rock is a field shape kind and validates like one', () => {
    expect(FIELD_SHAPE_KINDS).toContain('rock');
    expect(validateFieldTerms([{ op: 'add', shape: { kind: 'rock', center: [0, 0, 0], size: 1, rock: 'basalt' } }])).toEqual([]);
    const errs = validateFieldTerms([{ op: 'add', shape: { kind: 'rock', center: [0, 0, 0], size: -1, rock: 'granit', octaves: 9 } }]).join(' ');
    expect(errs).toMatch(/unknown preset 'granit'/); expect(errs).toMatch(/size: the rock's longest extent/); expect(errs).toMatch(/octaves: an integer 0–6/);
  });
  it('unit: the same rock in cm has the same grains at 100× the numbers', () => {
    const m = rockField(GRANITE), cm = rockField({ ...GRANITE, size: 10, unit: 'cm' });
    for (const x of [-0.03, 0.0, 0.02]) expect(cm.colorAt([x * 100, 1, 0.5], 0)).toBe(m.colorAt([x, 0.01, 0.005], 0));
    expect(cm.meta.grain).toBeCloseTo(100 * m.meta.grain, 12);
    expect(validateRockSpec({ size: 1, unit: 'ft' })[0]).toMatch(/unit/);
  });
  it('validateRockSpec: joints and colour', () => {
    expect(validateRockSpec({ size: 1, joints: { above: 0 } })[0]).toMatch(/joints/);
    expect(validateRockSpec({ size: 1, color: 'rainbow' })[0]).toMatch(/color/);
    expect(validateRockSpec({ size: 1, joints: { above: 2, prob: 0.5 }, color: 'mean' })).toEqual([]);
  });
});
