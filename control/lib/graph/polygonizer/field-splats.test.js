import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { surfaceSplats, coatBounds, COAT_DEFAULT } from './field-splats.js';
import { surfaceNetFaces } from './field-mesh.js';
import { sphere, roundCone, smoothUnion } from './field-terms.js';

const P = (x, y, z) => ({ x, y, z });
// A blob with real curvature variation — the case the coat is for.
const BLOB = smoothUnion(
  roundCone({ a: P(0, 0, -0.5), b: P(0, 0, 0.3), ra: 0.42, rb: 0.30 }),
  sphere({ center: P(0, -0.1, 0.65), radius: 0.28 }),
  0.16,
);
const BALL = sphere({ center: P(0, 0, 0), radius: 0.5 });

const hashOf = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('surfaceSplats — determinism', () => {
  it('same field + same coat → byte-identical splats', () => {
    const a = surfaceSplats(BLOB.d, BLOB.bounds, { depth: 0.04 }, { cells: 24 });
    const b = surfaceSplats(BLOB.d, BLOB.bounds, { depth: 0.04 }, { cells: 24 });
    expect(a.length).toBeGreaterThan(0);
    expect(hashOf(a)).toBe(hashOf(b));
  });

  it('carries no dice of its own — a re-run after Math.random is drained is identical', () => {
    const a = surfaceSplats(BLOB.d, BLOB.bounds, {}, { cells: 20 });
    for (let i = 0; i < 50; i++) Math.random();
    expect(hashOf(surfaceSplats(BLOB.d, BLOB.bounds, {}, { cells: 20 }))).toBe(hashOf(a));
  });

  it('the seeded jitter is stable per (cell, shell), not per call order', () => {
    const one = surfaceSplats(BALL.d, BALL.bounds, { layers: 3 }, { cells: 18 });
    const two = surfaceSplats(BALL.d, BALL.bounds, { layers: 3 }, { cells: 18 });
    for (let i = 0; i < one.length; i++) expect(two[i].c).toEqual(one[i].c);
  });
});

describe('surfaceSplats — the roots are the surface net\'s vertices', () => {
  it('the seated shell sits ON the iso-surface (|d| within a cell of zero)', () => {
    const seated = surfaceSplats(BALL.d, BALL.bounds, { layers: 1, depth: 0 }, { cells: 32 })
      .filter((s) => s.shell === 0);
    expect(seated.length).toBeGreaterThan(100);
    const span = BALL.bounds.max.x - BALL.bounds.min.x;
    const cell = span / 32;
    for (const s of seated) {
      expect(Math.abs(BALL.d({ x: s.c[0], y: s.c[1], z: s.c[2] }))).toBeLessThan(cell);
    }
  });

  it('seated count tracks the surface net\'s quad count in the same order of magnitude', () => {
    const faces = surfaceNetFaces(BALL.d, BALL.bounds, { cells: 28 });
    const seated = surfaceSplats(BALL.d, BALL.bounds, { layers: 1 }, { cells: 28 });
    const ratio = seated.length / faces.length;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(3);
  });
});

describe('surfaceSplats — orientation', () => {
  it('the normal is the outward field gradient (on a ball, it is the radial)', () => {
    const splats = surfaceSplats(BALL.d, BALL.bounds, { layers: 1 }, { cells: 24 });
    for (const s of splats) {
      const radial = [s.c[0], s.c[1], s.c[2]];
      const l = len(radial) || 1;
      expect(dot(s.n, [radial[0] / l, radial[1] / l, radial[2] / l])).toBeGreaterThan(0.85);
    }
  });

  it('t1, t2, n form a unit orthogonal frame', () => {
    for (const s of surfaceSplats(BLOB.d, BLOB.bounds, {}, { cells: 16 })) {
      expect(len(s.n)).toBeCloseTo(1, 6);
      expect(len(s.t1)).toBeCloseTo(1, 6);
      expect(len(s.t2)).toBeCloseTo(1, 6);
      expect(Math.abs(dot(s.n, s.t1))).toBeLessThan(1e-6);
      expect(Math.abs(dot(s.n, s.t2))).toBeLessThan(1e-6);
      expect(Math.abs(dot(s.t1, s.t2))).toBeLessThan(1e-6);
    }
  });

  it('the gaussian is a flat disc — the normal axis is the short one', () => {
    for (const s of surfaceSplats(BALL.d, BALL.bounds, { layers: 1 }, { cells: 16 })) {
      expect(s.scale[2]).toBeLessThan(s.scale[0]);
      expect(s.scale[0]).toBeCloseTo(s.scale[1], 9);
    }
  });
});

describe('surfaceSplats — the shells', () => {
  it('alpha decays outward and the seated shell is opaque', () => {
    const splats = surfaceSplats(BLOB.d, BLOB.bounds, { layers: 4 }, { cells: 16 });
    const byShell = new Map();
    for (const s of splats) byShell.set(s.shell, s.alpha);
    expect(byShell.get(0)).toBeCloseTo(1, 9);
    for (let s = 1; s < 4; s++) expect(byShell.get(s)).toBeLessThan(byShell.get(s - 1));
  });

  it('outer shells are thinned — each carries fewer splats than the one inside it', () => {
    const splats = surfaceSplats(BLOB.d, BLOB.bounds, { layers: 4, keep: 0.55 }, { cells: 20 });
    const counts = [0, 0, 0, 0];
    for (const s of splats) counts[s.shell]++;
    for (let s = 1; s < 4; s++) expect(counts[s]).toBeLessThan(counts[0]);
  });

  it('outer shells stand off the surface — depth 0 collapses them onto it', () => {
    const grown = surfaceSplats(BALL.d, BALL.bounds, { layers: 3, depth: 0.12, jitter: 0, curl: 0, down: 0, flow: 0 }, { cells: 16 });
    const flat = surfaceSplats(BALL.d, BALL.bounds, { layers: 3, depth: 0, jitter: 0, curl: 0, down: 0, flow: 0 }, { cells: 16 });
    const outer = (set) => set.filter((s) => s.shell === 2).reduce((m, s) => Math.max(m, len(s.c)), 0);
    expect(outer(grown)).toBeGreaterThan(outer(flat) + 0.1);
    expect(outer(flat)).toBeCloseTo(0.5, 1);
  });

  it('layers: 1 is the seated shell alone', () => {
    const splats = surfaceSplats(BALL.d, BALL.bounds, { layers: 1 }, { cells: 16 });
    expect(splats.every((s) => s.shell === 0)).toBe(true);
  });
});

describe('surfaceSplats — bounds honesty', () => {
  it('coatBounds grows the box by the coat\'s reach, never shrinks it', () => {
    const grown = coatBounds(BALL.bounds, { depth: 0.1 });
    for (const k of ['x', 'y', 'z']) {
      expect(grown.min[k]).toBeLessThan(BALL.bounds.min[k]);
      expect(grown.max[k]).toBeGreaterThan(BALL.bounds.max[k]);
    }
  });

  it('every splat lands inside coatBounds', () => {
    const coat = { depth: 0.1, layers: 4 };
    const b = coatBounds(BALL.bounds, coat);
    for (const s of surfaceSplats(BALL.d, BALL.bounds, coat, { cells: 20 })) {
      expect(s.c[0]).toBeGreaterThanOrEqual(b.min.x); expect(s.c[0]).toBeLessThanOrEqual(b.max.x);
      expect(s.c[1]).toBeGreaterThanOrEqual(b.min.y); expect(s.c[1]).toBeLessThanOrEqual(b.max.y);
      expect(s.c[2]).toBeGreaterThanOrEqual(b.min.z); expect(s.c[2]).toBeLessThanOrEqual(b.max.z);
    }
  });

  it('a degenerate box emits nothing rather than throwing', () => {
    const flat = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    expect(surfaceSplats(BALL.d, flat, {})).toEqual([]);
  });
});

describe('surfaceSplats — the dials', () => {
  it('density scales the splat count without changing the surface it sits on', () => {
    const lo = surfaceSplats(BALL.d, BALL.bounds, { density: 0.5, layers: 1 }, { cells: 32 });
    const hi = surfaceSplats(BALL.d, BALL.bounds, { density: 1.5, layers: 1 }, { cells: 32 });
    expect(hi.length).toBeGreaterThan(lo.length * 2);
  });

  it('tipColor lerps across the shells; a null colour stays null', () => {
    const tinted = surfaceSplats(BALL.d, BALL.bounds, { layers: 3, color: '#000000', tipColor: '#ffffff' }, { cells: 12 });
    const seated = tinted.find((s) => s.shell === 0), tip = tinted.find((s) => s.shell === 2);
    expect(seated.color).toBe('#000000');
    expect(tip.color).toBe('#ffffff');
    expect(surfaceSplats(BALL.d, BALL.bounds, {}, { cells: 12 })[0].color).toBeNull();
  });

  it('COAT_DEFAULT is frozen — a caller cannot mutate the shared dial', () => {
    expect(Object.isFrozen(COAT_DEFAULT)).toBe(true);
  });
});
