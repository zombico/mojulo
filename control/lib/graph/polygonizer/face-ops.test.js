import { describe, expect, it } from 'vitest';

import { applyFaceOps, validateFaceOps, FACE_OPS, DEFAULT_PORT_SIDES } from './face-ops.js';
import { shellToFaces } from './shell-faces.js';
import { selectFaces, faceSides, faceCenter, faceNormal, distinctCorners } from './face-select.js';
import { faceListToMesh } from '../figures/face-mesh.js';

const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s);
const cube = (extra = {}) => shellToFaces({ solid: 'cube', radius: 1, tint: '#808080', ...extra });
const byGroup = (faces, g) => faces.filter((f) => f.group === g);

const wellFormed = (faces) => faces.every((f) => (
  Array.isArray(f.corners) && f.corners.length >= 3
  && f.corners.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))
  && isHex(f.fill) && f.doubleSided === true
  && Array.isArray(f.outNormal) && f.outNormal.every(Number.isFinite)
));

describe('applyFaceOps — plumbing', () => {
  it('an empty or absent op list returns the faces untouched', () => {
    const faces = cube();
    expect(applyFaceOps(faces, [])).toBe(faces);
    expect(applyFaceOps(faces, undefined)).toBe(faces);
  });

  it('never mutates the input face list', () => {
    const faces = cube();
    const snapshot = JSON.stringify(faces);
    applyFaceOps(faces, [{ op: 'inset', select: {}, ratio: 0.3 }, { op: 'extrude', select: { group: 'inset' }, by: 0.1 }]);
    expect(JSON.stringify(faces)).toBe(snapshot);
  });

  it('is deterministic — the same op list re-renders byte-identical', () => {
    const ops = [{ op: 'inset', select: { facing: '+z' }, by: 0.2 }, { op: 'port', select: { group: 'inset' }, radius: 0.2, depth: 0.3 }];
    expect(JSON.stringify(applyFaceOps(cube(), ops))).toBe(JSON.stringify(applyFaceOps(cube(), ops)));
  });

  it('unselected faces pass through by reference', () => {
    const faces = cube();
    const out = applyFaceOps(faces, [{ op: 'recolor', select: { facing: '+z' }, tint: '#ff0000' }]);
    const untouched = selectFaces(faces, { not: { facing: '+z' } });
    for (const i of untouched) expect(out[i]).toBe(faces[i]);
  });
});

describe('inset', () => {
  it('replaces each face with a rim ring plus a smaller inset panel', () => {
    const out = applyFaceOps(cube(), [{ op: 'inset', select: { facing: '+z' }, ratio: 0.25 }]);
    // 5 untouched faces + 4 rim quads + 1 inset panel
    expect(out).toHaveLength(5 + 4 + 1);
    expect(byGroup(out, 'inset')).toHaveLength(1);
    expect(byGroup(out, 'rim')).toHaveLength(4);
    expect(wellFormed(out)).toBe(true);
  });

  it('the inset panel is coplanar with, and smaller than, the face it replaced', () => {
    const before = cube();
    const top = before[selectFaces(before, { facing: '+z' })[0]];
    const out = applyFaceOps(before, [{ op: 'inset', select: { facing: '+z' }, ratio: 0.25 }]);
    const panel = byGroup(out, 'inset')[0];
    expect(faceCenter(panel)[2]).toBeCloseTo(faceCenter(top)[2], 9);
    expect(faceNormal(panel)[2]).toBeCloseTo(1, 9);
    const span = (f) => Math.max(...distinctCorners(f).map((p) => Math.hypot(p[0], p[1])));
    expect(span(panel)).toBeCloseTo(span(top) * 0.75, 9);
  });

  it('`by` insets by a literal distance measured against the inradius', () => {
    // the cube's faces are 2/sqrt(3) across → inradius 1/sqrt(3) ≈ 0.5774
    const out = applyFaceOps(cube(), [{ op: 'inset', select: { facing: '+z' }, by: 0.2 }]);
    const panel = byGroup(out, 'inset')[0];
    const inr = (f) => Math.min(...distinctCorners(f).map((p, i, a) => {
      const b = a[(i + 1) % a.length];
      return Math.abs((p[0] + b[0]) / 2) || Math.abs((p[1] + b[1]) / 2);
    }));
    expect(inr(panel)).toBeCloseTo(1 / Math.sqrt(3) - 0.2, 6);
  });

  it('refuses a `by` that would collapse the face, naming the inradius', () => {
    expect(() => applyFaceOps(cube(), [{ op: 'inset', select: { facing: '+z' }, by: 5 }]))
      .toThrow(/exceeds face .* inradius/);
  });

  it('refuses a concave face rather than self-intersecting', () => {
    const dart = [{ corners: [[0, 0, 0], [4, 0, 0], [2, 1, 0], [4, 4, 0], [0, 4, 0]], outNormal: [0, 0, 1] }];
    expect(() => applyFaceOps(dart, [{ op: 'inset', select: {}, ratio: 0.2 }])).toThrow(/concave/);
  });

  it('tags rim and panel with overridable groups', () => {
    const out = applyFaceOps(cube(), [{ op: 'inset', select: { facing: '+z' }, ratio: 0.3, group: 'window', rimGroup: 'frame' }]);
    expect(byGroup(out, 'window')).toHaveLength(1);
    expect(byGroup(out, 'frame')).toHaveLength(4);
  });
});

describe('extrude', () => {
  it('pushes the face along its normal, leaving walls behind it', () => {
    const out = applyFaceOps(cube(), [{ op: 'extrude', select: { facing: '+z' }, by: 0.5 }]);
    expect(out).toHaveLength(5 + 4 + 1);
    const panel = byGroup(out, 'panel')[0];
    expect(faceCenter(panel)[2]).toBeCloseTo(1 / Math.sqrt(3) + 0.5, 9);
    expect(byGroup(out, 'wall')).toHaveLength(4);
    expect(wellFormed(out)).toBe(true);
  });

  it('a negative `by` recesses the face, and the walls still face outward', () => {
    const out = applyFaceOps(cube(), [{ op: 'extrude', select: { facing: '+z' }, by: -0.3 }]);
    const panel = byGroup(out, 'panel')[0];
    expect(faceCenter(panel)[2]).toBeCloseTo(1 / Math.sqrt(3) - 0.3, 9);
    for (const w of byGroup(out, 'wall')) {
      const c = faceCenter(w);
      // a recess wall points AWAY from the pocket's axis (outward in xy), not into it
      expect(c[0] * w.outNormal[0] + c[1] * w.outNormal[1]).toBeGreaterThan(0);
    }
  });

  it('the panel keeps the original face normal', () => {
    const out = applyFaceOps(cube(), [{ op: 'extrude', select: { facing: '-x' }, by: 0.4 }]);
    expect(byGroup(out, 'panel')[0].outNormal[0]).toBeCloseTo(-1, 9);
  });
});

describe('recolor', () => {
  it('changes the fill without changing the geometry', () => {
    const before = cube();
    const out = applyFaceOps(before, [{ op: 'recolor', select: { facing: '+z' }, tint: '#39c2d7' }]);
    expect(out).toHaveLength(before.length);
    const i = selectFaces(before, { facing: '+z' })[0];
    expect(out[i].corners).toEqual(before[i].corners);
    expect(out[i].fill).not.toBe(before[i].fill);
    expect(out[i].tint).toBe('#39c2d7');
  });

  it('a material recolor carries the pbr channel', () => {
    const out = applyFaceOps(cube(), [{ op: 'recolor', select: { facing: '+z' }, material: 'gold' }]);
    const i = selectFaces(out, { facing: '+z' })[0];
    expect(Array.isArray(out[i].pbr)).toBe(true);
  });

  it('can retag a group so a later op can select it', () => {
    const out = applyFaceOps(cube(), [
      { op: 'recolor', select: { facing: '+z' }, group: 'lid' },
      { op: 'extrude', select: { group: 'lid' }, by: 0.2 },
    ]);
    expect(byGroup(out, 'panel')).toHaveLength(1);
  });
});

describe('port', () => {
  it('is ADDITIVE — the host face survives and a cylinder is seated on it', () => {
    const before = cube();
    const out = applyFaceOps(before, [{ op: 'port', select: { facing: '+z' }, radius: 0.2, depth: 0.3 }]);
    expect(out).toHaveLength(before.length + DEFAULT_PORT_SIDES + 1);
    for (let i = 0; i < before.length; i += 1) expect(out[i]).toBe(before[i]);
    expect(byGroup(out, 'port')).toHaveLength(DEFAULT_PORT_SIDES + 1);
    expect(wellFormed(out)).toBe(true);
  });

  it('stands on the face center along the face normal', () => {
    const out = applyFaceOps(cube(), [{ op: 'port', select: { facing: '+z' }, radius: 0.2, depth: 0.3 }]);
    const cap = byGroup(out, 'port').find((f) => faceSides(f) === DEFAULT_PORT_SIDES);
    const c = faceCenter(cap);
    expect(c[0]).toBeCloseTo(0, 9);
    expect(c[1]).toBeCloseTo(0, 9);
    expect(c[2]).toBeCloseTo(1 / Math.sqrt(3) + 0.3, 9);
  });

  it('honours a custom side count', () => {
    const out = applyFaceOps(cube(), [{ op: 'port', select: { facing: '+z' }, radius: 0.2, depth: 0.3, sides: 6 }]);
    expect(byGroup(out, 'port')).toHaveLength(7);
  });

  it('refuses a port that would overhang its own face', () => {
    expect(() => applyFaceOps(cube(), [{ op: 'port', select: { facing: '+z' }, radius: 2, depth: 0.3 }]))
      .toThrow(/does not fit on face/);
  });

  it('seats one port per selected face', () => {
    const out = applyFaceOps(cube(), [{ op: 'port', select: {}, radius: 0.2, depth: 0.2, sides: 4 }]);
    expect(byGroup(out, 'port')).toHaveLength(6 * 5);
  });
});

describe('composition — the panel-module pipeline', () => {
  const ball = () => shellToFaces({
    solid: 'truncated_icosahedron',
    radius: 2,
    tint: '#e8e6e0',
    ops: [
      { op: 'inset', select: { sides: 6 }, ratio: 0.2 },
      { op: 'extrude', select: { group: 'inset' }, by: 0.12, material: 'brushed-steel' },
      { op: 'recolor', select: { sides: 5, every: 3 }, tint: '#39c2d7' },
    ],
  });

  it('op 2 selects the group op 1 created', () => {
    const faces = ball();
    // 20 hexagons → 20 panels pushed out, each leaving 6 rim + 6 wall quads; 12 pentagons untouched
    expect(byGroup(faces, 'panel')).toHaveLength(20);
    expect(byGroup(faces, 'rim')).toHaveLength(20 * 6);
    expect(byGroup(faces, 'wall')).toHaveLength(20 * 6);
    expect(byGroup(faces, 'inset')).toHaveLength(0);   // every inset was consumed by the extrude
    expect(wellFormed(faces)).toBe(true);
  });

  it('every third pentagon is recoloured — 4 of the 12', () => {
    expect(ball().filter((f) => f.tint === '#39c2d7')).toHaveLength(4);
  });

  it('the finished object still lowers through faceListToMesh', () => {
    const mesh = faceListToMesh(ball());
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
  });

  it('derived faces carry ids traceable to the face they came from', () => {
    const faces = shellToFaces({ solid: 'cube', radius: 1, ops: [{ op: 'inset', select: { facing: '+z' }, ratio: 0.3 }] });
    const panel = byGroup(faces, 'inset')[0];
    expect(panel.faceId).toMatch(/^0:\d+\/i$/);
    const parent = panel.faceId.split('/')[0];
    expect(byGroup(faces, 'rim').every((f) => f.faceId.startsWith(`${parent}/r`))).toBe(true);
  });

  it('ops run over the shell AS CUT by `open`', () => {
    const faces = shellToFaces({
      solid: 'cube', radius: 1,
      open: { facing: '-z' },
      ops: [{ op: 'extrude', select: {}, by: 0.1 }],
    });
    expect(byGroup(faces, 'panel')).toHaveLength(5);   // the removed floor got no panel
  });
});

describe('errors teach', () => {
  it('an op matching nothing is a refusal, not a silent no-op', () => {
    expect(() => applyFaceOps(cube(), [{ op: 'inset', select: { sides: 5 }, ratio: 0.2 }]))
      .toThrow(/matched no faces/);
  });

  it('the refusal reports what the face list actually offers', () => {
    expect(() => applyFaceOps(cube(), [{ op: 'inset', select: { sides: 5 }, ratio: 0.2 }]))
      .toThrow(/groups: 'shell'×6; polygons: 4-sided×6/);
  });

  it('an unknown op lists the ops', () => {
    expect(() => applyFaceOps(cube(), [{ op: 'bevel', select: {} }])).toThrow(new RegExp(FACE_OPS.join(', ')));
  });

  it('errors name the op position', () => {
    expect(() => applyFaceOps(cube(), [
      { op: 'recolor', select: {}, tint: '#111111' },
      { op: 'inset', select: { sides: 9 }, ratio: 0.2 },
    ], { at: 'shells[0].ops' })).toThrow(/shells\[0\]\.ops\[1\] \(inset\)/);
  });
});

describe('validateFaceOps', () => {
  const ok = (op) => validateFaceOps([op]);

  it('accepts well-formed ops', () => {
    expect(validateFaceOps(undefined)).toEqual([]);
    expect(ok({ op: 'inset', select: { sides: 6 }, by: 0.2 })).toEqual([]);
    expect(ok({ op: 'extrude', select: {}, by: -0.1, material: 'gold' })).toEqual([]);
    expect(ok({ op: 'recolor', select: {}, tint: '#abcdef' })).toEqual([]);
    expect(ok({ op: 'port', select: {}, radius: 0.1, depth: 0.2, sides: 8 })).toEqual([]);
  });

  it('an unknown or missing op is refused', () => {
    expect(ok({ op: 'bevel', select: {} })[0]).toMatch(new RegExp(FACE_OPS.join(', ')));
    expect(ok({ select: {} })[0]).toMatch(/required/);
    expect(validateFaceOps('nope')[0]).toMatch(/must be an array/);
  });

  it('a bad selector is caught before render', () => {
    expect(ok({ op: 'recolor', select: { facing: 'up' }, tint: '#ffffff' })[0]).toMatch(/^ops\[0\]\.select: /);
  });

  it('inset needs exactly one of by / ratio', () => {
    expect(ok({ op: 'inset', select: {} })[0]).toMatch(/exactly one of/);
    expect(ok({ op: 'inset', select: {}, by: 0.2, ratio: 0.2 })[0]).toMatch(/exactly one of/);
    expect(ok({ op: 'inset', select: {}, ratio: 1 })[0]).toMatch(/ratio/);
    expect(ok({ op: 'inset', select: {}, by: -1 })[0]).toMatch(/by/);
  });

  it('extrude and port need their distances', () => {
    expect(ok({ op: 'extrude', select: {} })[0]).toMatch(/by/);
    expect(ok({ op: 'extrude', select: {}, by: 0 })[0]).toMatch(/by/);
    expect(ok({ op: 'port', select: {}, depth: 1 })[0]).toMatch(/radius/);
    expect(ok({ op: 'port', select: {}, radius: 1 })[0]).toMatch(/depth/);
    expect(ok({ op: 'port', select: {}, radius: 1, depth: 1, sides: 2 })[0]).toMatch(/sides/);
  });

  it('a recolor that changes nothing is refused', () => {
    expect(ok({ op: 'recolor', select: {} })[0]).toMatch(/at least one of/);
  });

  it('material typos and bad tints are refused', () => {
    expect(ok({ op: 'recolor', select: {}, material: 'golden' })[0]).toMatch(/^ops\[0\]\.material: /);
    expect(ok({ op: 'recolor', select: {}, tint: 'cyan' })[0]).toMatch(/#rrggbb/);
  });

  it('indexes errors by op position', () => {
    expect(validateFaceOps([{ op: 'recolor', select: {}, tint: '#000000' }, { op: 'nope' }])[0]).toMatch(/^ops\[1\]/);
  });
});
