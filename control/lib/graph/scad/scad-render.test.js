import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseOff, offToRecords, shadeRecords, validateScadSource, validateScadParts,
  renderScadFaces, planScad, loadOpenscad, openscadVersion, DEFAULT_TINT,
  validateScadFields, fieldPrelude, auditManifold,
} from './scad-render.js';
import { scadExport } from '../scene/scene-scad.js';

const here = dirname(fileURLToPath(import.meta.url));
const DUO = readFileSync(join(here, 'fixtures/iphone-duo.scad'), 'utf8');
const DUO_PARTS = { half_a: 'half_a(); hinge();', half_b: 'half_b();' };

const hasWasm = await loadOpenscad() != null;
const wasm = hasWasm ? it : it.skip;

describe('scad-render — the fence', () => {
  it('refuses include / use / import / surface, ignoring comments', () => {
    expect(validateScadSource('include <MCAD/boxes.scad>\ncube(1);')).toHaveLength(1);
    expect(validateScadSource('use <lib.scad>\ncube(1);')).toHaveLength(1);
    expect(validateScadSource('import("part.stl");')).toHaveLength(1);
    expect(validateScadSource('surface(file = "h.png");')).toHaveLength(1);
    expect(validateScadSource('// include <x.scad>\n/* import("a") */ cube(1);')).toEqual([]);
    expect(validateScadSource('')).toHaveLength(1);
  });
  it('parts must be named identifiers with a statement', () => {
    expect(validateScadParts(undefined)).toEqual([]);
    expect(validateScadParts({ lid: 'lid();' })).toEqual([]);
    expect(validateScadParts({})).toHaveLength(1);
    expect(validateScadParts({ 'bad name': 'x();' })).toHaveLength(1);
    expect(validateScadParts({ lid: '' })).toHaveLength(1);
    expect(validateScadParts([])).toHaveLength(1);
  });
});

describe('scad-render — OFF → faces', () => {
  const OFF = `OFF
# a coloured unit right-triangle prism, three faces shown
4 3 0
0 0 0
1 0 0
0 1 0
0 0 1
3 0 1 2 255 0 0
3 0 1 3
4 0 1 2 3 0.5 0.5 1.0
`;
  it('reads vertices, faces, int and float colour columns', () => {
    const g = parseOff(OFF);
    expect(g.vertices).toHaveLength(4);
    expect(g.faces[0]).toEqual({ idx: [0, 1, 2], rgb: [255, 0, 0] });
    expect(g.faces[1]).toEqual({ idx: [0, 1, 3], rgb: null });
    expect(g.faces[2].rgb.map(Math.round)).toEqual([128, 128, 255]);
  });
  it('fans polygons, tints from colour, shades under a light with an outward normal', () => {
    const recs = offToRecords(parseOff(OFF), { group: 'g' });
    expect(recs).toHaveLength(1 + 1 + 2);
    expect(recs[0].tint).toBe('#ff0000');
    expect(recs[1].tint).toBe(DEFAULT_TINT);
    expect(recs[0].normal.map((v) => Math.round(v * 100) / 100)).toEqual([0, 0, 1]);
    const faces = shadeRecords(recs);
    expect(faces[0].corners).toHaveLength(4);
    expect(faces[0].corners[0]).toEqual(faces[0].corners[3]);
    expect(faces[0].group).toBe('g');
    expect(faces[0].fill).toMatch(/^#[0-9a-f]{6}$/);
    expect(faces[0].outNormal).toEqual(recs[0].normal);
  });
});

describe('scad-render — OpenSCAD in-process (skipped when the WASM is not installed)', () => {
  wasm('reports a pinned version', async () => {
    expect(await openscadVersion()).toMatch(/^\d{4}\.\d{2}/);
  });

  wasm('a cube renders deterministically to closed, coloured faces', async () => {
    const m = { source: 'color("#ff8800") cube([10, 20, 30]);' };
    const a = await renderScadFaces(m);
    const b = await renderScadFaces(m);
    expect(a).toHaveLength(12);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(new Set(a.map((f) => f.tint))).toEqual(new Set(['#ff8800']));
    expect(new Set(a.map((f) => f.group))).toEqual(new Set(['body']));
    const { stats } = await planScad(m);
    expect(stats.size).toEqual({ w: 10, d: 20, h: 30 });
    expect(stats.ledger.closed).toBe(true);
    expect(stats.parts[0].faces).toBe(12);
  });

  wasm('a program that fails to evaluate reports OpenSCAD\'s error, not a crash', async () => {
    await expect(planScad({ source: 'cube([1, 1, 1);' })).rejects.toThrow(/OpenSCAD could not render|ERROR/i);
  });

  wasm('an empty top level is refused with the parts hint', async () => {
    await expect(planScad({ source: 'module m() { cube(1); }' })).rejects.toThrow(/makes no geometry/);
  });

  wasm('with parts, a source that makes top-level geometry is refused', async () => {
    await expect(planScad({ source: 'module m() { cube(1); } m();', parts: { a: 'm();' } })).rejects.toThrow(/must only DEFINE modules/);
  });

  // The characterization pin: the iPhone Duo block-in (the object the plan measured) — the same
  // bounds as the native OpenSCAD 2026.09.10 render. Faces: 2,256 + 2,668 — each part is its own
  // render (so the hinge can swing one), so the two halves are NOT unioned across the seam; the
  // single-render native count is 4,788.
  wasm('the iPhone Duo pins: 4,924 faces, 165.3 × 118.65 × 8.4 mm, two groups', async () => {
    const m = { source: DUO, parts: DUO_PARTS, units: 'mm' };
    const { stats } = await planScad(m);
    expect(stats.faces).toBe(4924);
    expect(stats.parts.map((p) => p.faces)).toEqual([2256, 2668]);
    expect(stats.size).toEqual({ w: 165.3, d: 118.7, h: 8.4 });
    expect(stats.parts.map((p) => p.name)).toEqual(['half_a', 'half_b']);
    expect(stats.parts.every((p) => !p.open)).toBe(true);
    expect(stats.warnings ?? []).toEqual([]);
    const faces = await renderScadFaces(m);
    expect(new Set(faces.map((f) => f.group))).toEqual(new Set(['half_a', 'half_b']));
    expect(faces.some((f) => f.tint === '#2b3242')).toBe(true);
  });

  wasm('a mover naming no part is an advisory', async () => {
    const { stats } = await planScad({ source: DUO, parts: DUO_PARTS, movers: [{ group: 'lid', turn: { center: [0, 0, 0], axis: [0, 1, 0] }, states: [0, 1] }] });
    expect(stats.warnings.join('\n')).toMatch(/group 'lid' names no part/);
  });
}, 60000);

describe('scad-render — export_model format:scad is the identity', () => {
  it('returns the stored source verbatim with the parts as the assembly and one exact term', () => {
    const r = scadExport({ manifest: { kind: 'scad', source: 'module m() { cube(1); }', parts: { a: 'm();' }, units: 'cm' }, payload: null, ref: 'sk_x', title: 't' });
    expect(r.text).toContain('module m() { cube(1); }');
    expect(r.text).toContain('m();   // a');
    expect(r.text).toContain('Authored in cm (10 mm per unit)');
    expect(r.coverage).toEqual({ exact: 1, baked: 0, terms: [{ at: 'source', what: 'scad', status: 'exact' }] });
    expect(r.triangleCount).toBe(0);
    expect(r.parts).toEqual([{ name: 'a', at: 'parts.a' }]);
  });
});

describe('scad-render — mojulo_field(): the field escape hatch (skipped when the WASM is not installed)', () => {
  const blob = { id: 'blob', cells: 32, terms: [
    { op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 8 } },
    { op: 'stroke', at: [6, 0, 4], radius: 4, strength: 1 },
  ] };

  it('validates: every field needs a unique identifier id', () => {
    expect(validateScadFields(undefined)).toEqual([]);
    expect(validateScadFields([blob])).toEqual([]);
    expect(validateScadFields([{ ...blob, id: undefined }])).toHaveLength(1);
    expect(validateScadFields([blob, blob])).toHaveLength(1);
    expect(validateScadFields('x')).toHaveLength(1);
  });

  it('a field whose surface net folds (heavy displace) is refused at mint, not dropped silently', async () => {
    const folded = { id: 'dent', cells: 48, terms: [
      { op: 'add', shape: { kind: 'ellipsoid', center: [0, 0, 0], radii: [12, 8, 6] } },
      { op: 'displace', noise: { amplitude: 0.6, scale: 0.4, octaves: 2, seed: 'pebble' } },
    ] };
    await expect(planScad({ source: 'mojulo_field("dent");', fields: [folded] })).rejects.toThrow(/cannot take .* unpaired/);
    expect(auditManifold([{ corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] }]).manifold).toBe(false);
  });

  it('the prelude is one module with a polyhedron per field, memoised', () => {
    const p = fieldPrelude([blob]);
    expect(p).toContain('module mojulo_field(id)');
    expect(p).toContain('if (id == "blob")');
    expect(p).toContain('polyhedron(');
    expect(fieldPrelude([blob])).toBe(p);
    expect(fieldPrelude([])).toBe('');
  });

  wasm('a sculpted blob is subtracted from a cube with an exact rim', async () => {
    const m = {
      source: 'difference() { translate([0, 0, 10]) cube(20, center = true); translate([0, 0, 12]) mojulo_field("blob"); }',
      fields: [blob],
    };
    const { stats } = await planScad(m);
    expect(stats.size).toEqual({ w: 20, d: 20, h: 20 });
    expect(stats.faces).toBeGreaterThan(12);
    expect(stats.ledger.closed).toBe(true);
    await expect(planScad({ ...m, source: 'mojulo_field("nope");' })).rejects.toThrow(/no field named/);
  });
}, 60000);
