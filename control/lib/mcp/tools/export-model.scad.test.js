// openscad-leg.plan.md phase 2 — `export_model({ format: 'scad' })`.
//
// The leg's odd seam: every other format serialises the resolved FACE payload, this one
// transpiles the RECIPE. So what these tests watch is the wiring that makes that true — the
// `code` kind hands over its EXPANDED monomers, `cuts` lower on the way in, the print leg's
// scale strategy is reused, and the coverage ledger reaches the result and the README.
//
// Decision 6 is the load-bearing posture test: nothing refuses the format.

// Isolate to in-memory SQLite + a scratch outcomes dir — must run before any
// import that pulls in db/index.js (same pattern as export-model.stl.test.js).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-scad-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';

const CYLINDER = {
  id: 'body',
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 6 },
  profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }],
};

const mint = (ref, manifest, title = ref) => SketchRepository.create({ ref, title, manifest });

describe('export_model scad', () => {
  it('transpiles a workbench to a program, reports coverage, and writes the file', async () => {
    mint('sk_scad_cyl', { kind: 'workbench', units: 'cm', lathes: [CYLINDER] });
    const res = await exportModelHandler({ ref: 'sk_scad_cyl', format: 'scad' });
    expect(res.ok).toBe(true);
    expect(res.format).toBe('scad');
    expect(res.url).toBe('/api/sketches/sk_scad_cyl/model.scad');
    expect(res.scad.exact).toBe(1);
    expect(res.scad.baked).toBe(0);
    expect(res.scad.parts).toEqual([{ name: 'body', at: 'lathes[0]' }]);

    const text = readFileSync(res.path, 'utf8');
    expect(text).toContain('rotate_extrude(angle = 360)');
    expect(text).toContain('module body()');
    expect(text).not.toContain('polyhedron(');
  });

  it('reuses the print leg\'s scale strategy: a literal kind derives mm from units', async () => {
    mint('sk_scad_units', { kind: 'workbench', units: 'cm', lathes: [CYLINDER] });
    const res = await exportModelHandler({ ref: 'sk_scad_units', format: 'scad' });
    expect(res.scale).toBe(10);
    expect(res.scad.mm_per_unit).toBe(10);
    expect(res.print_profile).toBe('literal');
    expect(readFileSync(res.path, 'utf8')).toContain('mm_per_unit = 10;');
  });

  it('declares size_mm from the PRINTABLE set, not every face — the studio grid is not in the file', async () => {
    // Found by the phase 3 gate on a real render: a 120 mm disc declared 302 mm, because
    // facesBounds counts the workbench's measuring grid. The grid is not a monomer, so it
    // never reaches the .scad at all, and declaring it made every verdict disagree.
    mint('sk_scad_grid', {
      kind: 'workbench',
      units: 'cm',
      lathes: [{ id: 'disc', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1.2 }, profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }] }],
    });
    const res = await exportModelHandler({ ref: 'sk_scad_grid', format: 'scad' });
    // the disc is 6 cm in radius ⇒ 120 mm across at scale 10, and nothing wider
    expect(res.size_mm[0]).toBeGreaterThan(110);
    expect(res.size_mm[0]).toBeLessThan(125);
    expect(res.size_mm[2]).toBeCloseTo(12, 1);
    expect(res.note).toContain("mojulo's mesh measures");
  });

  it('an explicit scale overrides the derivation, and reaches the file', async () => {
    mint('sk_scad_scale', { kind: 'workbench', units: 'cm', lathes: [CYLINDER] });
    const res = await exportModelHandler({ ref: 'sk_scad_scale', format: 'scad', scale: 2 });
    expect(res.scad.mm_per_unit).toBe(2);
    expect(readFileSync(res.path, 'utf8')).toContain('mm_per_unit = 2;');
  });

  it('lowers `cuts` on the way in, so a named boolean arrives as an exact difference()', async () => {
    mint('sk_scad_cut', {
      kind: 'workbench',
      units: 'mm',
      lathes: [{ id: 'disc', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 12 }, profile: [{ t: 0, radius: 60 }, { t: 1, radius: 60 }] }],
      sweeps: [{ id: 'bore', path: [[0, 0, -10], [0, 0, 30]], radius: 12 }],
      cuts: [{ from: 'disc', subtract: ['bore'], cells: 16 }],
    });
    const res = await exportModelHandler({ ref: 'sk_scad_cut', format: 'scad' });
    expect(res.scad.baked).toBe(0);
    const text = readFileSync(res.path, 'utf8');
    expect(text).toContain('difference()');
    expect(text).not.toContain('polyhedron(');
  });

  it('a `code` kind hands over the monomers its PROGRAM returned, not the source', async () => {
    mint('sk_scad_code', {
      kind: 'workbench',
      units: 'mm',
      program: {
        source: "return { lathes: Array.from({ length: params.n }, (_, i) => ({ id: 'ring' + i, axisFrom: { x: i * 10, y: 0, z: 0 }, axisTo: { x: i * 10, y: 0, z: 4 }, profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }] })) };",
        params: { n: 3 },
      },
    });
    const res = await exportModelHandler({ ref: 'sk_scad_code', format: 'scad' });
    expect(res.ok).toBe(true);
    // three lathes generated by the program, each its own exact module
    expect(res.scad.exact).toBe(3);
    expect(res.scad.parts.map((p) => p.name)).toEqual(['ring0', 'ring1', 'ring2']);
    const text = readFileSync(res.path, 'utf8');
    expect((text.match(/rotate_extrude\(angle = 360\)/g) || []).length).toBe(3);
    // the program's JS must NOT leak into the OpenSCAD file
    expect(text).not.toContain('Array.from');
  });

  it('names every baked term in the result and in the file', async () => {
    mint('sk_scad_blend', {
      kind: 'workbench',
      units: 'mm',
      fields: [{ id: 'blob', cells: 16, terms: [
        { id: 'body', op: 'add', shape: { kind: 'sphere', center: [0, 0, 0], radius: 8 } },
        { id: 'bump', op: 'add', blend: 2, shape: { kind: 'sphere', center: [6, 0, 0], radius: 4 } },
        { id: 'bore', op: 'subtract', shape: { kind: 'capsule', a: [0, 0, -12], b: [0, 0, 12], radius: 1.5 } },
      ] }],
    });
    const res = await exportModelHandler({ ref: 'sk_scad_blend', format: 'scad' });
    expect(res.scad.exact).toBe(1);
    expect(res.scad.baked).toBe(2);
    expect(res.note).toContain('fields[0].terms[1] (add)');
    expect(res.note).toContain('had no OpenSCAD equivalent');
    const text = readFileSync(res.path, 'utf8');
    expect(text).toContain('polyhedron(');
    expect(text).toContain('difference()');          // the exact bore still cuts the bake
  });

  it('DECISION 6: no kind refuses — a figure arrives fully baked with stl named as the better file', async () => {
    mint('sk_scad_fig', { kind: 'figure', pose: 'stand' });
    const res = await exportModelHandler({ ref: 'sk_scad_fig', format: 'scad' });
    expect(res.ok).toBe(true);
    expect(res.scad.exact).toBe(0);
    expect(res.scad.baked).toBe(1);
    expect(res.note).toContain("`format: 'stl'` is the better file");
    expect(res.scad.frozen.points).toBeGreaterThan(0);
    expect(readFileSync(res.path, 'utf8')).toContain('polyhedron(');
  });

  it('reports zero frozen geometry for an all-exact file, and says why that is not emptiness', async () => {
    mint('sk_scad_zero', { kind: 'workbench', units: 'mm', lathes: [CYLINDER] });
    const res = await exportModelHandler({ ref: 'sk_scad_zero', format: 'scad' });
    expect(res.vertices).toBe(0);
    expect(res.triangles).toBe(0);
    expect(res.scad.frozen).toEqual({ points: 0, faces: 0 });
    expect(res.note).toContain('read 0 by construction');
  });

  it('carries the OpenSCAD notes into the export README', async () => {
    mint('sk_scad_readme', { kind: 'workbench', units: 'mm', lathes: [CYLINDER] });
    const res = await exportModelHandler({ ref: 'sk_scad_readme', format: 'scad' });
    const readme = readFileSync(path.join(path.dirname(res.path), 'README.md'), 'utf8');
    expect(readme).toContain('this one is a PROGRAM, not a mesh');
    expect(readme).toContain('mojulo does NOT read `.scad` back');
    expect(readme).toContain('$fn');
  });

  it('refuses the mesh-only options, which belong to formats that carry meshes', async () => {
    mint('sk_scad_opts', { kind: 'workbench', units: 'mm', lathes: [CYLINDER] });
    await expect(exportModelHandler({ ref: 'sk_scad_opts', format: 'scad', union: true })).rejects.toThrow(/union/);
    await expect(exportModelHandler({ ref: 'sk_scad_opts', format: 'scad', lit: true })).rejects.toThrow(/lit/);
    await expect(exportModelHandler({ ref: 'sk_scad_opts', format: 'scad', quantize: true })).rejects.toThrow(/quantize/);
    await expect(exportModelHandler({ ref: 'sk_scad_opts', format: 'scad', strict: true })).rejects.toThrow(/strict/);
    await expect(exportModelHandler({ ref: 'sk_scad_opts', format: 'scad', printer: { process: 'fdm' } })).rejects.toThrow(/printer/);
  });

  it('leaves every other format byte-identical — the leg is additive', async () => {
    mint('sk_scad_additive', { kind: 'workbench', units: 'cm', lathes: [CYLINDER] });
    const stl = await exportModelHandler({ ref: 'sk_scad_additive', format: 'stl' });
    const before = readFileSync(stl.path);
    await exportModelHandler({ ref: 'sk_scad_additive', format: 'scad' });
    const after = readFileSync((await exportModelHandler({ ref: 'sk_scad_additive', format: 'stl' })).path);
    expect(after.equals(before)).toBe(true);
  });

  it('rejects an unknown format, naming scad among the known ones', async () => {
    mint('sk_scad_bad', { kind: 'workbench', units: 'mm', lathes: [CYLINDER] });
    await expect(exportModelHandler({ ref: 'sk_scad_bad', format: 'step' })).rejects.toThrow(/'scad'/);
  });
});
