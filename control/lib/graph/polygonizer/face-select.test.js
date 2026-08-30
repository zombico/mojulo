import { describe, expect, it } from 'vitest';

import {
  selectFaces, validateSelector, describeFaces, summarizeFaces,
  faceCenter, faceNormal, faceSides, distinctCorners, SELECTOR_KEYS,
} from './face-select.js';

// A unit cube as six quads, in a fixed order: +z, -z, +x, -x, +y, -y.
const CUBE = [
  { corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], outNormal: [0, 0, 1], group: 'shell' },
  { corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], outNormal: [0, 0, -1], group: 'shell' },
  { corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], outNormal: [1, 0, 0], group: 'shell' },
  { corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], outNormal: [-1, 0, 0], group: 'shell' },
  { corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], outNormal: [0, 1, 0], group: 'panel' },
  { corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], outNormal: [0, -1, 0], group: 'panel' },
];

describe('face geometry helpers', () => {
  it('faceSides collapses the fan-quad duplicate corner (a closed triangle is a triangle)', () => {
    // extrude-faces.js emits fan caps as [c, a, b, c] — 4 entries, 3 real corners.
    const fanQuad = { corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0]] };
    expect(fanQuad.corners.length).toBe(4);
    expect(faceSides(fanQuad)).toBe(3);
    expect(distinctCorners(fanQuad)).toHaveLength(3);
  });

  it('faceCenter is the centroid of the distinct corners', () => {
    expect(faceCenter(CUBE[0])).toEqual([0.5, 0.5, 1]);
  });

  it('faceNormal prefers the authored outNormal', () => {
    expect(faceNormal(CUBE[2])).toEqual([1, 0, 0]);
  });

  it('faceNormal falls back to a Newell normal when outNormal is absent', () => {
    const bare = { corners: CUBE[0].corners };
    const n = faceNormal(bare);
    expect(Math.abs(n[2])).toBeCloseTo(1, 9);
    expect(Math.hypot(...n)).toBeCloseTo(1, 9);
  });

  it('a degenerate face does not throw', () => {
    expect(faceSides({ corners: [] })).toBe(0);
    expect(faceCenter({})).toEqual([0, 0, 0]);
    expect(faceNormal({ corners: [[0, 0, 0]] })).toEqual([0, 0, 1]);
  });
});

describe('selectFaces — filters', () => {
  it('an empty selector selects everything, in face-list order', () => {
    expect(selectFaces(CUBE, {})).toEqual([0, 1, 2, 3, 4, 5]);
    expect(selectFaces(CUBE)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('facing picks the single face pointing that way (default 45° cone)', () => {
    expect(selectFaces(CUBE, { facing: '+z' })).toEqual([0]);
    expect(selectFaces(CUBE, { facing: '-x' })).toEqual([3]);
  });

  it('a wide cone catches the neighbours; a narrow one does not', () => {
    // 90° from +z catches the four side faces (exactly perpendicular) plus the top.
    expect(selectFaces(CUBE, { facing: '+z', within: 90 })).toEqual([0, 2, 3, 4, 5]);
    expect(selectFaces(CUBE, { facing: '+z', within: 10 })).toEqual([0]);
  });

  it('facing accepts a literal vector', () => {
    expect(selectFaces(CUBE, { facing: [0, 0, 5] })).toEqual([0]);
  });

  it('group filters on the face tag', () => {
    expect(selectFaces(CUBE, { group: 'panel' })).toEqual([4, 5]);
    expect(selectFaces(CUBE, { group: 'nope' })).toEqual([]);
  });

  it('sides filters on the polygon corner count', () => {
    expect(selectFaces(CUBE, { sides: 4 })).toHaveLength(6);
    expect(selectFaces(CUBE, { sides: 5 })).toEqual([]);
  });

  it('ring bands measure against the model z-extent', () => {
    expect(selectFaces(CUBE, { ring: 'top' })).toEqual([0]);
    expect(selectFaces(CUBE, { ring: 'bottom' })).toEqual([1]);
    // the four side faces are centered at z=0.5, the model's mid
    expect(selectFaces(CUBE, { ring: 'equator' })).toEqual([2, 3, 4, 5]);
  });

  it('a flat model has no bands — every ring matches everything', () => {
    const flat = [CUBE[0], { ...CUBE[0], group: 'b' }];
    expect(selectFaces(flat, { ring: 'top' })).toEqual([0, 1]);
  });

  it('multiple keys AND together', () => {
    expect(selectFaces(CUBE, { sides: 4, facing: '+y' })).toEqual([4]);
    expect(selectFaces(CUBE, { group: 'panel', facing: '+z' })).toEqual([]);
  });
});

describe('selectFaces — composition', () => {
  it('not excludes a sub-selector', () => {
    expect(selectFaces(CUBE, { group: 'shell', not: { facing: '+z' } })).toEqual([1, 2, 3]);
  });

  it('and intersects with a sub-selector', () => {
    expect(selectFaces(CUBE, { ring: 'equator', and: { group: 'panel' } })).toEqual([4, 5]);
  });

  it('sub-selectors resolve against the whole list, so intersection is order-independent', () => {
    const a = selectFaces(CUBE, { group: 'shell', and: { ring: 'equator' } });
    const b = selectFaces(CUBE, { ring: 'equator', and: { group: 'shell' } });
    expect(a).toEqual(b);
    expect(a).toEqual([2, 3]);
  });
});

describe('selectFaces — ranking and decimation', () => {
  it('near + count takes the N best-aligned faces', () => {
    expect(selectFaces(CUBE, { near: [1, 0, 0], count: 1 })).toEqual([2]);
    expect(selectFaces(CUBE, { near: [0, -1, 0], count: 1 })).toEqual([5]);
  });

  it('near ties break on face index, so the pick is total and reproducible', () => {
    // toward +z: the top face wins outright; the four side faces are all exactly perpendicular,
    // so the runner-up is the lowest-indexed of them (2), never a coin flip.
    expect(selectFaces(CUBE, { near: [0, 0, 1], count: 2 })).toEqual([0, 2]);
  });

  it('near returns face-list order, not alignment order', () => {
    const picked = selectFaces(CUBE, { near: [1, 1, 0], count: 2 });
    expect(picked).toEqual([...picked].sort((a, b) => a - b));
  });

  it('count without near truncates in face-list order', () => {
    expect(selectFaces(CUBE, { count: 3 })).toEqual([0, 1, 2]);
    expect(selectFaces(CUBE, { count: 0 })).toEqual([]);
  });

  it('every decimates the surviving selection', () => {
    expect(selectFaces(CUBE, { every: 2 })).toEqual([0, 2, 4]);
    expect(selectFaces(CUBE, { every: 3 })).toEqual([0, 3]);
    expect(selectFaces(CUBE, { group: 'shell', every: 2 })).toEqual([0, 2]);
  });
});

describe('selectFaces — determinism and purity', () => {
  it('is pure: never mutates the input faces', () => {
    const snapshot = JSON.stringify(CUBE);
    selectFaces(CUBE, { facing: '+z', every: 2, not: { group: 'panel' } });
    expect(JSON.stringify(CUBE)).toBe(snapshot);
  });

  it('repeated selection is identical', () => {
    const sel = { ring: 'equator', sides: 4, every: 2 };
    expect(selectFaces(CUBE, sel)).toEqual(selectFaces(CUBE, sel));
  });

  it('an empty list and an unmatched selector both return [] rather than throwing', () => {
    expect(selectFaces([], { facing: '+z' })).toEqual([]);
    expect(selectFaces(CUBE, { sides: 7 })).toEqual([]);
  });
});

describe('selectFaces — errors teach', () => {
  it('an unknown selector key lists the valid ones', () => {
    expect(() => selectFaces(CUBE, { facing: '+z', colour: 'red' })).toThrow(/unknown selector key 'colour'/);
    expect(() => selectFaces(CUBE, { colour: 'red' })).toThrow(new RegExp(SELECTOR_KEYS.join(', ')));
  });

  it('an unknown axis lists the axes', () => {
    expect(() => selectFaces(CUBE, { facing: 'up' })).toThrow(/\+x, -x, \+y, -y, \+z, -z/);
  });

  it('out-of-range knobs are refused', () => {
    expect(() => selectFaces(CUBE, { facing: '+z', within: 0 })).toThrow(/'within'/);
    expect(() => selectFaces(CUBE, { ring: 'equator', band: 2 })).toThrow(/'band'/);
    expect(() => selectFaces(CUBE, { every: 0 })).toThrow(/'every'/);
    expect(() => selectFaces(CUBE, { count: -1 })).toThrow(/'count'/);
    expect(() => selectFaces(CUBE, { sides: 2 })).toThrow(/'sides'/);
  });

  it('a dangling modifier is refused rather than silently ignored', () => {
    expect(() => selectFaces(CUBE, { within: 20 })).toThrow(/only means something alongside 'facing'/);
    expect(() => selectFaces(CUBE, { band: 0.2 })).toThrow(/only means something alongside 'ring'/);
  });

  it('a non-object selector is refused', () => {
    expect(() => selectFaces(CUBE, [{ facing: '+z' }])).toThrow(/must be an object/);
  });
});

describe('validateSelector', () => {
  it('returns null for a well-formed selector', () => {
    expect(validateSelector({ facing: '+z', within: 30, every: 2 })).toBe(null);
    expect(validateSelector(undefined)).toBe(null);
  });

  it('catches per-key errors that an empty-list run would have skipped', () => {
    expect(validateSelector({ facing: 'up' })).toMatch(/\+x, -x/);
    expect(validateSelector({ ring: 'middle' })).toMatch(/equator, top, bottom/);
    expect(validateSelector({ ring: 'equator', band: 5 })).toMatch(/'band'/);
    expect(validateSelector({ sides: 1 })).toMatch(/'sides'/);
  });

  it('prefixes the caller-supplied location', () => {
    expect(validateSelector({ nope: 1 }, 'shells[0].ops[2].select')).toMatch(/^shells\[0\]\.ops\[2\]\.select: /);
  });
});

describe('describeFaces / summarizeFaces', () => {
  it('reports groups, polygon counts, and the z-extent', () => {
    const d = describeFaces(CUBE);
    expect(d.count).toBe(6);
    expect(d.groups).toEqual([{ name: 'shell', count: 4 }, { name: 'panel', count: 2 }]);
    expect(d.sides).toEqual([{ sides: 4, count: 6 }]);
    expect(d.zExtent).toEqual({ min: 0, max: 1, span: 1 });
  });

  it('summarizes for an error message', () => {
    expect(summarizeFaces(CUBE)).toBe("6 faces — groups: 'shell'×4, 'panel'×2; polygons: 4-sided×6");
    expect(summarizeFaces([])).toBe('0 faces — groups: none; polygons: none');
  });
});
