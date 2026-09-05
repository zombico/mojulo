/**
 * field-faces — the `fields` monomer (field-solids.plan.md F3). Claims: union / subtract /
 * intersect fixtures close with ZERO boundary edges (closed by construction — non-zero is a bug);
 * the bored flange has genus 1 (V − E + F = 0 on the welded quad mesh); `group` tags land on the
 * right faces for a two-term object; byte-identical re-render; the validator teaches.
 */
import { describe, expect, it } from 'vitest';

import { fieldToFaces, validateFields, fieldGrid, DEFAULT_CELLS, MAX_FIELD_CELLS } from './field-faces.js';
import { findOpenBoundaries } from './face-closure.js';
import { selectFaces } from './face-select.js';

const flange = {
  terms: [
    { id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, 1], profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }] } },
    { id: 'bore', op: 'subtract', shape: { kind: 'sweep', path: [[0, 0, -1], [0, 0, 2]], radius: 1 } },
  ],
  cells: 48,
};

// Euler characteristic of a face list after welding corners by position: V − E + F.
function eulerCharacteristic(faces) {
  const key = (c) => c.map((v) => Math.round(v * 1e6)).join(',');
  const verts = new Set(), edges = new Set();
  for (const f of faces) {
    const ks = f.corners.map(key);
    for (let i = 0; i < ks.length; i += 1) {
      verts.add(ks[i]);
      const a = ks[i], b = ks[(i + 1) % ks.length];
      if (a !== b) edges.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
  }
  return verts.size - edges.size + faces.length;
}

describe('fieldToFaces — closed by construction', () => {
  it('union / subtract / intersect fixtures all close with zero boundary edges', () => {
    const a = { kind: 'sphere', center: [0, 0, 0], radius: 1 };
    const b = { kind: 'box', center: [0.7, 0, 0], size: [1.2, 1.2, 1.2] };
    for (const op of ['add', 'subtract', 'intersect']) {
      const faces = fieldToFaces({ terms: [{ op: 'add', shape: a }, { op, shape: b }], cells: 32 });
      expect(faces.length).toBeGreaterThan(100);
      expect(findOpenBoundaries(faces).boundaryEdgeCount).toBe(0);
      expect(faces.every((f) => f.corners.length === 4 && f.doubleSided === true && Array.isArray(f.outNormal) && /^#[0-9a-f]{6}$/i.test(f.fill))).toBe(true);
    }
  });
  it('the bored flange is a torus: genus 1 (V − E + F = 0), closed', () => {
    const faces = fieldToFaces(flange);
    expect(findOpenBoundaries(faces).boundaryEdgeCount).toBe(0);
    expect(eulerCharacteristic(faces)).toBe(0);
    // and a plain disc is a sphere-like solid: χ = 2
    const disc = fieldToFaces({ terms: [flange.terms[0]], cells: 32 });
    expect(eulerCharacteristic(disc)).toBe(2);
  });
  it('sculpt terms (stroke + displace) and shell keep closure', () => {
    const pebble = {
      terms: [
        { id: 'body', op: 'add', shape: { kind: 'ellipsoid', center: [0, 0, 1], radii: [1.6, 1.1, 0.9] } },
        { op: 'stroke', at: [1.2, 0.4, 1.4], radius: 0.5, strength: 1 },
        { op: 'stroke', at: [-1, 0, 1.2], radius: 0.4, strength: -1 },
        { op: 'displace', noise: { amplitude: 0.06, scale: 0.5, octaves: 3, seed: 'pebble' } },
      ],
      cells: 40,
    };
    expect(findOpenBoundaries(fieldToFaces(pebble)).boundaryEdgeCount).toBe(0);
    const cup = { terms: [flange.terms[0], { op: 'shell', thickness: 0.2 }], cells: 40 };
    const cupFaces = fieldToFaces(cup);
    expect(findOpenBoundaries(cupFaces).boundaryEdgeCount).toBe(0);
    expect(eulerCharacteristic(cupFaces)).toBe(4);   // two nested closed surfaces
  });
  it('a translated field moves as a whole (an assembled part stacking)', () => {
    const base = fieldToFaces({ terms: [flange.terms[0]], cells: 24 });
    const moved = fieldToFaces({ terms: [flange.terms[0]], cells: 24, translate: [0, 0, 5] });
    expect(moved.length).toBe(base.length);
    const zs = (faces) => faces.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.min(...zs(moved))).toBeCloseTo(Math.min(...zs(base)) + 5, 6);
  });
});

describe('fieldToFaces — semantic tags', () => {
  it('`group` names the nearest term: bore faces select as a group, disc faces as the other', () => {
    const faces = fieldToFaces(flange);
    const bore = selectFaces(faces, { group: 'bore' }).map((i) => faces[i]);   // selectFaces returns indices
    const disc = selectFaces(faces, { group: 'disc' }).map((i) => faces[i]);
    expect(bore.length + disc.length).toBe(faces.length);
    expect(bore.length).toBeGreaterThan(20);
    expect(disc.length).toBeGreaterThan(bore.length);
    // every bore face sits at about the bore radius inside the disc's height; every disc face is
    // either further out (the rim) or on a cap plane (the annulus reaches in to the bore edge)
    const cen = (f) => f.corners.reduce((m, c) => [m[0] + c[0] / 4, m[1] + c[1] / 4, m[2] + c[2] / 4], [0, 0, 0]);
    const r = (f) => Math.hypot(cen(f)[0], cen(f)[1]);
    expect(bore.every((f) => r(f) < 1.6 && cen(f)[2] > -0.1 && cen(f)[2] < 1.1)).toBe(true);
    expect(disc.every((f) => r(f) > 1.4 || Math.abs(cen(f)[2]) < 0.15 || Math.abs(cen(f)[2] - 1) < 0.15)).toBe(true);
  });
  it('unnamed terms get positional ids; a single-term solid tags every face with it', () => {
    const faces = fieldToFaces({ terms: [{ op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 1 } }], cells: 16 });
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['term0']));
  });
});

describe('fieldToFaces — determinism, cost dial, materials', () => {
  it('byte-identical re-render', () => {
    expect(JSON.stringify(fieldToFaces(flange))).toBe(JSON.stringify(fieldToFaces(flange)));
  });
  it('`cells` is the resolution dial with a hard backstop; the grid is padded past the surface', () => {
    const lo = fieldToFaces({ ...flange, cells: 24 }).length;
    const hi = fieldToFaces({ ...flange, cells: 48 }).length;
    expect(hi).toBeGreaterThan(lo * 2.5);
    const g = fieldGrid({ terms: flange.terms });
    expect(g.cells).toBe(DEFAULT_CELLS);
    expect(g.cell).toBeCloseTo(6 / DEFAULT_CELLS);
    expect(g.bounds.min.x).toBeLessThan(-3);
    expect(fieldGrid({ terms: flange.terms, cells: 10000 }).cells).toBe(MAX_FIELD_CELLS);
  });
  it('a material rides along as face tags and tints the albedo', () => {
    const plain = fieldToFaces({ ...flange, cells: 20 });
    const gold = fieldToFaces({ ...flange, cells: 20 }, { material: 'gold' });
    expect(gold.length).toBe(plain.length);
    expect(gold.every((f) => Array.isArray(f.spec) || f.pbr)).toBe(true);
    expect(gold[0].fill).not.toBe(plain[0].fill);
  });
});

describe('validateFields', () => {
  it('accepts the flange', () => { expect(validateFields([flange])).toEqual([]); });
  it('teaches on a bad cells dial, a bad translate, and passes term errors through with the path', () => {
    expect(validateFields([{ ...flange, cells: 4 }])[0]).toMatch(/cells: must be an integer in \[16, 128\]/);
    expect(validateFields([{ ...flange, translate: [0, 0] }])[0]).toMatch(/translate/);
    expect(validateFields([{ terms: [] }])[0]).toMatch(/fields\[0\]\.terms: must be a non-empty/);
    expect(validateFields([{ terms: [{ op: 'subtract', shape: flange.terms[1].shape }] }])[0]).toMatch(/fields\[0\]\.terms\[0\]\.op: the first term must be 'add'/);
    expect(validateFields([null])[0]).toMatch(/must be an object/);
  });
});
