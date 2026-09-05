/**
 * field-terms — the shared SDF term library (field-solids.plan.md F2). Claims under
 * test: every primitive has the right sign at a known inside/outside point (and the exact
 * distance where exactness is promised); the boolean of two spheres has the analytic
 * volume; the face-list twins (lathe / extrude / sweep) agree with their monomers;
 * `noise3` is deterministic per seed; overlapping strokes do NOT commute (pinned, so the
 * order semantics never silently change); bounds grow exactly when the surface can.
 */
import { describe, expect, it } from 'vitest';

import {
  sphere, ellipsoid, roundCone, box, capsule, sweepField, extrudeField, latheField,
  union, subtract, intersect, smoothUnion, smoothSubtract, shell, round, stroke, displace,
  composeFieldTerms, validateFieldTerms, FIELD_SHAPE_KINDS, FIELD_OPS,
} from './field-terms.js';
import { smin, smax } from './vajra.js';
import { noise3, noise3Amplitude } from './fields.js';
import { latheToFaces } from './lathe-faces.js';
import { extrudeToFaces } from './extrude-faces.js';

// test-local seeded dice (the same mulberry32 the builders use) — Monte-Carlo needs a fixed stream
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const O = { x: 0, y: 0, z: 0 };
const P = (x, y, z) => ({ x, y, z });

describe('primitive terms — sign and distance', () => {
  it('sphere: exact', () => {
    const s = sphere({ center: [1, 0, 0], radius: 2 });
    expect(s.d(P(1, 0, 0))).toBeCloseTo(-2);
    expect(s.d(P(4, 0, 0))).toBeCloseTo(1);
    expect(s.bounds).toEqual({ min: { x: -1, y: -2, z: -2 }, max: { x: 3, y: 2, z: 2 } });
  });
  it('ellipsoid: right sign, zero on the surface', () => {
    const e = ellipsoid({ center: O, radii: [2, 1, 0.5] });
    expect(e.d(O)).toBeLessThan(0);
    expect(e.d(P(2, 0, 0))).toBeCloseTo(0, 6);
    expect(e.d(P(0, 0, 0.5))).toBeCloseTo(0, 6);
    expect(e.d(P(0, 1.5, 0))).toBeGreaterThan(0);
  });
  it('roundCone: inside along the axis, outside beyond the caps', () => {
    const c = roundCone({ a: O, b: [0, 0, 2], ra: 0.5, rb: 0.25 });
    expect(c.d(P(0, 0, 1))).toBeLessThan(0);
    expect(c.d(P(0, 0, 2.5))).toBeGreaterThan(0);
    expect(c.d(P(0, 0, -0.5))).toBeCloseTo(0, 6);
  });
  it('box: exact, and `round` inflates its corners', () => {
    const b = box({ center: O, size: [2, 2, 2] });
    expect(b.d(O)).toBeCloseTo(-1);
    expect(b.d(P(2, 0, 0))).toBeCloseTo(1);
    expect(b.d(P(2, 2, 0))).toBeCloseTo(Math.SQRT2);
    const rb = box({ center: O, size: [2, 2, 2], round: 0.5 });
    expect(rb.d(P(1, 0, 0))).toBeCloseTo(0, 6);        // faces stay put
    expect(rb.d(P(1, 1, 1))).toBeGreaterThan(0);        // the corner is shaved
  });
  it('capsule: exact', () => {
    const c = capsule({ a: O, b: [0, 0, 2], radius: 0.5 });
    expect(c.d(P(0.25, 0, 1))).toBeCloseTo(-0.25);
    expect(c.d(P(0, 0, 3))).toBeCloseTo(0.5);
  });
  it('sweepField: a polyline tube, exact', () => {
    const s = sweepField({ path: [[0, 0, 0], [2, 0, 0], [2, 2, 0]], radius: 0.3 });
    expect(s.d(P(1, 0, 0))).toBeCloseTo(-0.3);
    expect(s.d(P(2, 1, 0))).toBeCloseTo(-0.3);
    expect(s.d(P(1, 1, 0))).toBeCloseTo(1 - 0.3);
  });
});

describe('the face-list twins', () => {
  it('extrudeField (rect): exact prism distance, and its profile plane matches extrudeToFaces', () => {
    const spec = { profile: { rect: { w: 2, h: 1 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 3 } };
    const f = extrudeField(spec);
    expect(f.d(P(0, 0, 1.5))).toBeCloseTo(-0.5);        // nearest wall is the h/2 side
    expect(f.d(P(0, 0, 4))).toBeCloseTo(1);             // above the top cap
    expect(f.d(P(3, 0, 1.5))).toBeCloseTo(2);           // beside the w/2 wall
    // every face-list corner lies ON the field's zero set (same frame, same profile)
    for (const face of extrudeToFaces(spec)) for (const c of face.corners) expect(Math.abs(f.d(P(...c)))).toBeLessThan(1e-6);
  });
  it('extrudeField (points): an L-bracket, polygon distance with the right sign', () => {
    const f = extrudeField({ profile: { points: [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]] }, axisFrom: [0, 0, 0], axisTo: [0, 0, 1] });
    expect(f.d(P(0.5, 0.5, 0.5))).toBeLessThan(0);
    expect(f.d(P(1.5, 1.5, 0.5))).toBeGreaterThan(0);   // the notch
  });
  it('latheField: exact distance to a surface of revolution, corners of latheToFaces on the zero set', () => {
    const spec = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] };
    const f = latheField(spec);
    expect(f.d(P(0.5, 0, 1))).toBeCloseTo(-0.5);
    expect(f.d(P(0, 0, 1))).toBeCloseTo(-1);            // the axis is NOT an edge
    expect(f.d(P(2, 0, 1))).toBeCloseTo(1);
    expect(f.d(P(0, 0, 3))).toBeCloseTo(1);
    for (const face of latheToFaces(spec, { samples: 12, crossSections: 4 })) for (const c of face.corners) expect(Math.abs(f.d(P(...c)))).toBeLessThan(1e-6);
  });
  it('latheField with harmonics: a bound with the right zero set, phase-aligned with latheToFaces', () => {
    const spec = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], harmonics: [{ n: 6, amplitude: 0.1 }] };
    const f = latheField(spec);
    const wall = latheToFaces(spec, { samples: 24, crossSections: 2, caps: false });
    for (const face of wall) for (const c of face.corners) expect(Math.abs(f.d(P(...c)))).toBeLessThan(1e-6);
    expect(f.d(P(0.5, 0, 1))).toBeLessThan(0);
    expect(f.d(P(1.5, 0, 1))).toBeGreaterThan(0);
  });
});

describe('combinators', () => {
  const A = sphere({ center: O, radius: 1 });
  const B = sphere({ center: [0.8, 0, 0], radius: 0.6 });
  it('union / subtract / intersect have the boolean signs', () => {
    expect(union(A, B).d(P(1.2, 0, 0))).toBeLessThan(0);
    expect(subtract(A, B).d(P(0.8, 0, 0))).toBeGreaterThan(0);
    expect(subtract(A, B).d(P(-0.5, 0, 0))).toBeLessThan(0);
    expect(intersect(A, B).d(P(0.5, 0, 0))).toBeLessThan(0);
    expect(intersect(A, B).d(P(-0.5, 0, 0))).toBeGreaterThan(0);
  });
  it('subtract of two spheres has the analytic volume (seeded Monte-Carlo)', () => {
    const R = 1, r = 0.6, d = 0.8;
    const lens = Math.PI * (R + r - d) ** 2 * (d * d + 2 * d * r - 3 * r * r + 2 * d * R + 6 * r * R - 3 * R * R) / (12 * d);
    const expected = (4 / 3) * Math.PI * R ** 3 - lens;
    const S = subtract(A, B);
    const rng = mulberry32(7);
    const N = 200000; let inside = 0;
    for (let i = 0; i < N; i += 1) {
      const p = P(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      if (S.d(p) <= 0) inside += 1;
    }
    const vol = (inside / N) * 8;
    expect(Math.abs(vol - expected) / expected).toBeLessThan(0.03);
  });
  it('smax is the twin of smin: >= the hard max, equal when k=0', () => {
    expect(smax(0.2, 0.5, 0)).toBe(0.5);
    for (const [a, b] of [[0.1, 0.2], [-0.3, 0.1], [0.5, 0.5]]) {
      expect(smax(a, b, 0.4)).toBeGreaterThanOrEqual(Math.max(a, b) - 1e-12);
      expect(smax(a, b, 0.4)).toBeCloseTo(-smin(-a, -b, 0.4));
    }
  });
  it('smoothUnion bulges within k, smoothSubtract only removes', () => {
    const su = smoothUnion(A, B, 0.3), hu = union(A, B);
    const ss = smoothSubtract(A, B, 0.3), hs = subtract(A, B);
    const rng = mulberry32(3);
    for (let i = 0; i < 2000; i += 1) {
      const p = P(rng() * 3 - 1.5, rng() * 3 - 1.5, rng() * 3 - 1.5);
      expect(su.d(p)).toBeLessThanOrEqual(hu.d(p) + 1e-12);
      expect(hu.d(p) - su.d(p)).toBeLessThanOrEqual(0.3 / 4 + 1e-12);
      expect(ss.d(p)).toBeGreaterThanOrEqual(hs.d(p) - 1e-12);
    }
  });
  it('shell hollows, round inflates', () => {
    const sh = shell(A, 0.1);
    expect(sh.d(O)).toBeGreaterThan(0);                 // the core is now outside
    expect(sh.d(P(0.95, 0, 0))).toBeLessThan(0);        // the wall
    expect(round(A, 0.25).d(P(1.2, 0, 0))).toBeLessThan(0);
  });
});

describe('sculpt terms', () => {
  const body = sphere({ center: O, radius: 1 });
  it('a positive stroke adds a bump, a negative stroke carves a dent', () => {
    const bump = stroke(body, { at: [1, 0, 0], radius: 0.3, strength: 1 });
    expect(bump.d(P(1.2, 0, 0))).toBeLessThan(0);
    expect(body.d(P(1.2, 0, 0))).toBeGreaterThan(0);
    const dent = stroke(body, { at: [1, 0, 0], radius: 0.3, strength: -1 });
    expect(dent.d(P(0.85, 0, 0))).toBeGreaterThan(0);
    expect(body.d(P(0.85, 0, 0))).toBeLessThan(0);
  });
  it('disjoint strokes commute; overlapping strokes do NOT (pinned order semantics)', () => {
    const s1 = { at: [1, 0, 0], radius: 0.3, strength: 1 };
    const s2 = { at: [-1, 0, 0], radius: 0.3, strength: 1 };
    const s3 = { at: [1.1, 0.2, 0], radius: 0.3, strength: -1 };
    const probes = []; const rng = mulberry32(11);
    for (let i = 0; i < 500; i += 1) probes.push(P(rng() * 3 - 1.5, rng() * 3 - 1.5, rng() * 3 - 1.5));
    const ab = stroke(stroke(body, s1), s2), ba = stroke(stroke(body, s2), s1);
    for (const p of probes) expect(ab.d(p)).toBeCloseTo(ba.d(p), 10);
    const xy = stroke(stroke(body, s1), s3), yx = stroke(stroke(body, s3), s1);
    let differ = 0;
    for (const p of probes) if (Math.abs(xy.d(p) - yx.d(p)) > 1e-6) differ += 1;
    expect(differ).toBeGreaterThan(0);
  });
  it('noise3 is deterministic per seed, differs across seeds, and stays within its amplitude', () => {
    const o = { amplitude: 1, scale: 0.7, octaves: 4, persistence: 0.5, seed: 'pebble' };
    const rng = mulberry32(5);
    let maxAbs = 0, diff = 0;
    for (let i = 0; i < 2000; i += 1) {
      const p = P(rng() * 10 - 5, rng() * 10 - 5, rng() * 10 - 5);
      const a = noise3(p, o), b = noise3(p, o);
      expect(a).toBe(b);
      if (Math.abs(a - noise3(p, { ...o, seed: 'other' })) > 1e-9) diff += 1;
      maxAbs = Math.max(maxAbs, Math.abs(a));
    }
    expect(diff).toBeGreaterThan(1500);
    expect(maxAbs).toBeLessThanOrEqual(noise3Amplitude(o));
    expect(maxAbs).toBeGreaterThan(0.1);
  });
  it('displace moves the surface and pads the bounds by the worst-case reach', () => {
    const nz = { amplitude: 0.1, scale: 0.5, octaves: 3, seed: 1 };
    const dsp = displace(body, { noise: nz });
    expect(dsp.bounds.max.x).toBeCloseTo(1 + 0.1 * noise3Amplitude(nz));
    let moved = 0;
    for (let i = 0; i < 64; i += 1) { const th = (i / 64) * Math.PI * 2; if (Math.abs(dsp.d(P(Math.cos(th), Math.sin(th), 0))) > 1e-6) moved += 1; }
    expect(moved).toBeGreaterThan(50);
    expect(displace(body, { noise: { amplitude: 0 } })).toBe(body);
  });
});

describe('composeFieldTerms — the recipe list', () => {
  const flange = [
    { id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, 1], profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }] } },
    { id: 'bore', op: 'subtract', shape: { kind: 'sweep', path: [[0, 0, -1], [0, 0, 2]], radius: 1 } },
  ];
  it('folds top-down and keeps the parts for tagging', () => {
    const f = composeFieldTerms(flange);
    expect(f.parts.map((p) => p.id)).toEqual(['disc', 'bore']);
    expect(f.d(P(0, 0, 0.5))).toBeGreaterThan(0);       // inside the bore = outside the solid
    expect(f.d(P(2, 0, 0.5))).toBeLessThan(0);          // the ring
    expect(f.d(P(4, 0, 0.5))).toBeGreaterThan(0);
  });
  it('subtract never grows bounds; add / stroke / shell / round / displace do', () => {
    const base = composeFieldTerms(flange.slice(0, 1)).bounds;
    expect(composeFieldTerms(flange).bounds).toEqual(base);
    expect(composeFieldTerms([...flange, { op: 'add', shape: { kind: 'sphere', center: [5, 0, 0], radius: 1 } }]).bounds.max.x).toBeCloseTo(6);
    expect(composeFieldTerms([...flange, { op: 'stroke', at: [3, 0, 0.5], radius: 0.5, strength: 1 }]).bounds.max.x).toBeGreaterThan(3);
    expect(composeFieldTerms([...flange, { op: 'stroke', at: [3, 0, 0.5], radius: 0.5, strength: -1 }]).bounds).toEqual(base);
    expect(composeFieldTerms([...flange, { op: 'shell', thickness: 0.2 }]).bounds.max.x).toBeCloseTo(3.2);
    expect(composeFieldTerms([...flange, { op: 'round', radius: 0.2 }]).bounds.max.x).toBeCloseTo(3.2);
    expect(composeFieldTerms([...flange, { op: 'displace', noise: { amplitude: 0.1, octaves: 1 } }]).bounds.max.x).toBeCloseTo(3.1);
  });
  it('a blended add is a smooth union', () => {
    const hard = composeFieldTerms([flange[0], { op: 'add', shape: { kind: 'sphere', center: [3, 0, 0.5], radius: 0.5 } }]);
    const soft = composeFieldTerms([flange[0], { op: 'add', shape: { kind: 'sphere', center: [3, 0, 0.5], radius: 0.5 }, blend: 0.3 }]);
    const p = P(3.2, 0.45, 0.5);
    expect(soft.d(p)).toBeLessThan(hard.d(p));
  });
  it('validation teaches: empty list, non-add first, unknown op / kind, bad params', () => {
    expect(validateFieldTerms([])[0]).toMatch(/non-empty/);
    expect(validateFieldTerms([{ op: 'subtract', shape: { kind: 'sphere', center: O, radius: 1 } }])[0]).toMatch(/first term must be 'add'/);
    expect(validateFieldTerms([{ op: 'carve' }])[0]).toMatch(new RegExp(FIELD_OPS.join(' \\| ')));
    expect(validateFieldTerms([{ op: 'add', shape: { kind: 'torus' } }])[0]).toMatch(new RegExp(FIELD_SHAPE_KINDS.join(' \\| ')));
    expect(validateFieldTerms([{ op: 'add', shape: { kind: 'sphere', center: O, radius: -1 } }])[0]).toMatch(/radius/);
    expect(validateFieldTerms([{ op: 'add', shape: { kind: 'box', center: O, size: [1, 0, 1] } }])[0]).toMatch(/size/);
    expect(validateFieldTerms([{ op: 'add', shape: { kind: 'lathe', axisFrom: O, axisTo: O, profile: [{ t: 0, radius: 1 }] } }])[0]).toMatch(/must differ/);
    expect(validateFieldTerms([flange[0], { op: 'stroke', at: O, radius: 1, strength: 0 }])[0]).toMatch(/strength/);
    expect(validateFieldTerms([flange[0], { op: 'displace', noise: { amplitude: 0.1, octaves: 40 } }])[0]).toMatch(/octaves/);
    expect(validateFieldTerms(flange)).toEqual([]);
    expect(() => composeFieldTerms([{ op: 'nope' }])).toThrow(/op/);
  });
});
