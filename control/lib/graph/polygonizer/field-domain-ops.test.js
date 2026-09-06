/**
 * field-terms domain operators (expressiveness.plan.md E2): transform / repeat / twist /
 * bend / taper / elongate. Claims under test: each op keeps the right sign at a known
 * point; bounds cover the warped surface; a nested `terms` list is warped as a sub-solid
 * and combined (the bolt circle is `repeat polar` of ONE bore, subtracted); group ids
 * survive repetition and move with a transform; every fixture closes with a pinned genus;
 * byte-identical re-render; the validator teaches.
 */
import { describe, expect, it } from 'vitest';

import { composeFieldTerms, validateFieldTerms, FIELD_OPS, FIELD_DOMAIN_OPS } from './field-terms.js';
import { fieldToFaces } from './field-faces.js';
import { auditClosure } from './face-closure.js';

const genus = (faces) => {
  const V = new Set(), E = new Set();
  for (const f of faces) {
    const c = f.corners;
    for (let i = 0; i < c.length; i += 1) {
      V.add(c[i].join(','));
      const a = c[i].join(','), b = c[(i + 1) % c.length].join(',');
      E.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
  }
  return 1 - (V.size - E.size + faces.length) / 2;
};
const P = (x, y, z) => ({ x, y, z });
const closedWithGenus = (spec, g) => {
  const faces = fieldToFaces(spec);
  const audit = auditClosure(faces);
  expect(audit.closed).toBe(true);
  expect(audit.boundaryEdgeCount).toBe(0);
  expect(genus(faces)).toBe(g);
  return faces;
};

const disc = { id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, 1.2], profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] } };
const bore = { id: 'bore', op: 'add', shape: { kind: 'capsule', a: [0, 0, -1], b: [0, 0, 3], radius: 0.45 } };

describe('enum', () => {
  it('FIELD_OPS gained the six domain ops, append-only', () => {
    expect(FIELD_DOMAIN_OPS).toEqual(['transform', 'repeat', 'twist', 'bend', 'taper', 'elongate']);
    expect(FIELD_OPS.slice(0, 7)).toEqual(['add', 'subtract', 'intersect', 'stroke', 'displace', 'shell', 'round']);
    expect(FIELD_OPS.slice(7)).toEqual(FIELD_DOMAIN_OPS);
  });
});

describe('transform', () => {
  it('moves, rotates, scales — exact under uniform scale; bounds are the transformed corners', () => {
    const c = composeFieldTerms([
      { id: 's', op: 'add', shape: { kind: 'box', center: [0, 0, 0], size: [2, 1, 1] } },
      { op: 'transform', translate: [3, 0, 0], rotate: [0, 0, 90], scale: 2 },
    ]);
    expect(c.d(P(3, 0, 0))).toBeCloseTo(-1, 9);          // centre of a 4×2×2 box → half the short side
    expect(c.d(P(3, 2.5, 0))).toBeCloseTo(0.5, 9);       // the rotated LONG side now runs along y
    expect(c.d(P(3, 1.5, 0))).toBeCloseTo(-0.5, 9);
    expect(c.d(P(4.5, 0, 0))).toBeCloseTo(0.5, 9);       // and the short side along x
    expect(c.bounds.min.x).toBeCloseTo(2); expect(c.bounds.max.x).toBeCloseTo(4);
    expect(c.bounds.min.y).toBeCloseTo(-2); expect(c.bounds.max.y).toBeCloseTo(2);
    expect(c.parts[0].term.d(P(3, 0, 0))).toBeCloseTo(-1, 9);   // parts moved with it
  });
  it('mirror flips one axis', () => {
    const c = composeFieldTerms([
      { id: 's', op: 'add', shape: { kind: 'sphere', center: [2, 0, 0], radius: 1 } },
      { op: 'transform', mirror: 'x' },
    ]);
    expect(c.d(P(-2, 0, 0))).toBeCloseTo(-1);
    expect(c.d(P(2, 0, 0))).toBeCloseTo(3);
    expect(c.bounds.min.x).toBeCloseTo(-3); expect(c.bounds.max.x).toBeCloseTo(-1);
  });
  it('a nested sub-solid is placed by transform and combined (a bore transformed into place, subtracted)', () => {
    const faces = closedWithGenus({ cells: 48, terms: [
      disc,
      { op: 'transform', translate: [4, 0, 0], combine: 'subtract', terms: [bore] },
    ] }, 1);
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['disc', 'bore']));
    const boreFaces = faces.filter((f) => f.group === 'bore');
    const cx = boreFaces.reduce((s, f) => s + f.corners[0][0], 0) / boreFaces.length;
    expect(cx).toBeCloseTo(4, 0);
  });
});

describe('repeat', () => {
  it('polar: the bolt circle is ONE bore repeated, genus = count, every instance tagged `bore`', () => {
    const faces = closedWithGenus({ cells: 56, terms: [
      disc,
      { op: 'repeat', polar: { count: 6, radius: 4.5 }, combine: 'subtract', terms: [bore] },
    ] }, 6);
    const groups = new Set(faces.map((f) => f.group));
    expect(groups).toEqual(new Set(['disc', 'bore']));
    expect(faces.filter((f) => f.group === 'bore').length).toBeGreaterThan(100);
  });
  it('grid: a bounded lattice of holes with a COUNT — genus nx·ny for odd and even counts', () => {
    for (const count of [[4, 2, 1], [3, 3, 1]]) {
      closedWithGenus({ cells: 56, terms: [
        { id: 'plate', op: 'add', shape: { kind: 'box', center: [0, 0, 0], size: [12, 8, 1] } },
        { op: 'repeat', spacing: [2, 2, 0], count, combine: 'subtract', terms: [{ id: 'hole', op: 'add', shape: { kind: 'capsule', a: [0, 0, -1], b: [0, 0, 1], radius: 0.4 } }] },
      ] }, count[0] * count[1]);
    }
  });
  it('grid instances are centred on the original; bounds grow by (n−1)/2 · spacing per axis', () => {
    const c = composeFieldTerms([
      { id: 'peg', op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 0.5 } },
      { op: 'repeat', spacing: [3, 0, 0], count: [4, 1, 1] },
    ]);
    for (const x of [-4.5, -1.5, 1.5, 4.5]) expect(c.d(P(x, 0, 0))).toBeCloseTo(-0.5);
    expect(c.d(P(0, 0, 0))).toBeCloseTo(1);           // the gap between instances
    expect(c.d(P(7.5, 0, 0))).toBeCloseTo(2.5);       // bounded: no fifth instance
    expect(c.bounds.min.x).toBeCloseTo(-5); expect(c.bounds.max.x).toBeCloseTo(5);
    expect(c.parts).toHaveLength(1);
    expect(c.parts[0].term.d(P(4.5, 0, 0))).toBeCloseTo(-0.5);   // the part is the repeated field
  });
  it('polar without a nested list repeats the whole solid so far', () => {
    const c = composeFieldTerms([
      { id: 'peg', op: 'add', shape: { kind: 'sphere', center: [3, 0, 0], radius: 0.5 } },
      { op: 'repeat', polar: { axis: 'z', count: 4 } },
    ]);
    for (const [x, y] of [[3, 0], [0, 3], [-3, 0], [0, -3]]) expect(c.d(P(x, y, 0))).toBeCloseTo(-0.5);
    expect(c.bounds.max.y).toBeGreaterThanOrEqual(3.5);   // conservative: corner reach
    expect(c.bounds.max.y).toBeLessThan(3.6);
  });
});

describe('twist / bend / taper / elongate', () => {
  it('twist: a bar twisted half a turn stays closed, genus 0; a point on the original corner leaves the solid', () => {
    const terms = [{ id: 'bar', op: 'add', shape: { kind: 'box', center: [0, 0, 2], size: [1, 1, 4] } }, { op: 'twist', axis: 'z', turns: 0.5 }];
    closedWithGenus({ cells: 48, terms }, 0);
    const c = composeFieldTerms(terms);
    expect(c.d(P(0, 0, 2))).toBeLessThan(0);
    expect(c.d(P(0.45, 0.45, 0.05))).toBeLessThan(0);  // near the base: untwisted corner still inside
    expect(c.d(P(0.45, 0.45, 1))).toBeGreaterThan(0);  // a quarter turn up: the corner has rotated away
    expect(c.bounds.max.x).toBeCloseTo(Math.hypot(0.5, 0.5));
  });
  it('bend: a bar bent around a radius stays closed and reaches into the up-axis', () => {
    const terms = [{ id: 'bar', op: 'add', shape: { kind: 'box', center: [0, 0, 0], size: [6, 1, 1] } }, { op: 'bend', axis: 'x', radius: 4 }];
    closedWithGenus({ cells: 48, terms }, 0);
    const c = composeFieldTerms(terms);
    expect(c.d(P(0, 0, 0))).toBeLessThan(0);
    expect(c.d(P(2.9, 0, 0))).toBeGreaterThan(0);      // the straight tip is gone
    expect(c.bounds.max.y).toBeGreaterThan(0.5);        // the bend reaches into y
  });
  it('taper: the cross-section shrinks toward the high end', () => {
    const terms = [{ id: 'bar', op: 'add', shape: { kind: 'box', center: [0, 0, 2], size: [2, 2, 4] } }, { op: 'taper', axis: 'z', from: 1, to: 0.4 }];
    closedWithGenus({ cells: 48, terms }, 0);
    const c = composeFieldTerms(terms);
    expect(c.d(P(0.9, 0, 0.2))).toBeLessThan(0);       // wide at the bottom
    expect(c.d(P(0.9, 0, 3.8))).toBeGreaterThan(0);    // narrow at the top
    expect(c.d(P(0.3, 0, 3.8))).toBeLessThan(0);
  });
  it('elongate: a sphere becomes a capsule, exact', () => {
    const terms = [{ id: 's', op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 1 } }, { op: 'elongate', by: [2, 0, 0] }];
    closedWithGenus({ cells: 40, terms }, 0);
    const c = composeFieldTerms(terms);
    expect(c.d(P(1.5, 0, 0))).toBeCloseTo(-1, 9);
    expect(c.d(P(3.5, 0, 0))).toBeCloseTo(0.5, 9);
    expect(c.bounds.min.x).toBeCloseTo(-3); expect(c.bounds.max.x).toBeCloseTo(3);
  });
  it('a domain op with a nested list may open the term list', () => {
    const terms = [{ op: 'repeat', spacing: [2, 0, 0], count: [3, 1, 1], terms: [{ id: 'peg', op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 0.5 } }] }];
    expect(validateFieldTerms(terms)).toEqual([]);
    const faces = fieldToFaces({ cells: 40, terms });
    expect(auditClosure(faces).closed).toBe(true);
    expect(faces.every((f) => f.group === 'peg')).toBe(true);
  });
});

describe('byte-identity and the validator', () => {
  it('byte-identical re-render across every op', () => {
    const spec = { cells: 32, terms: [
      disc,
      { op: 'repeat', polar: { count: 5, radius: 4 }, combine: 'subtract', terms: [bore] },
      { op: 'twist', turns: 0.1 },
      { op: 'taper', from: 1, to: 0.8 },
      { op: 'elongate', by: [0, 0, 0.5] },
      { op: 'transform', rotate: [0, 10, 0] },
    ] };
    expect(JSON.stringify(fieldToFaces(spec))).toBe(JSON.stringify(fieldToFaces(spec)));
  });
  it('teaches on every op', () => {
    expect(validateFieldTerms([{ op: 'twist', turns: 1 }])).toEqual([expect.stringMatching(/first term must be 'add'.*or a domain op with a nested/)]);
    const base = { op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 1 } };
    const errs = validateFieldTerms([
      base,
      { op: 'repeat', count: [1, 1, 1], spacing: [1, 1, 1] },
      { op: 'repeat', polar: { count: 1 } },
      { op: 'bend', radius: 0, combine: 'add' },
      { op: 'twist', axis: 'w', turns: 0 },
      { op: 'taper', from: 0, to: 1 },
      { op: 'elongate', by: [-1, 0, 0] },
      { op: 'transform' },
      { op: 'transform', terms: [base], combine: 'xor', blend: -1, mirror: 'q' },
      { op: 'repeat', polar: { count: 3 }, terms: [{ op: 'subtract', shape: base.shape }] },
    ]);
    expect(errs).toEqual([
      expect.stringMatching(/terms\[1\]\.count: every count is 1/),
      expect.stringMatching(/terms\[2\]\.polar: must be \{ axis\?, count:int≥2/),
      expect.stringMatching(/terms\[3\]: `combine` \/ `blend` only apply with a nested/),
      expect.stringMatching(/terms\[3\]\.radius: must be a positive number/),
      expect.stringMatching(/terms\[4\]\.axis/),
      expect.stringMatching(/terms\[4\]\.turns/),
      expect.stringMatching(/terms\[5\]\.from\/\.to/),
      expect.stringMatching(/terms\[6\]\.by/),
      expect.stringMatching(/terms\[7\]: give at least one of/),
      expect.stringMatching(/terms\[8\]\.combine: must be one of add \| subtract \| intersect/),
      expect.stringMatching(/terms\[8\]\.blend/),
      expect.stringMatching(/terms\[8\]\.mirror/),
      expect.stringMatching(/terms\[9\]\.terms\[0\]\.op: the first term must be 'add'/),
    ]);
  });
});
