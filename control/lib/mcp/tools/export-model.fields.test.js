// field-solids.plan.md F4 — the export ledger for field solids: `field_solids` says in numbers
// (count, cells, edge rounding in mm on the print formats) what the recipe could not express
// sharply, and the field quads flow through STL / 3MF / GLB like every other face, closed.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-fields-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';

const FLANGE = {
  cells: 32,
  terms: [
    { id: 'disc', op: 'add', shape: { kind: 'lathe', axisFrom: [0, 0, 0], axisTo: [0, 0, 1], profile: [{ t: 0, radius: 3 }, { t: 1, radius: 3 }] } },
    { id: 'bore', op: 'subtract', shape: { kind: 'sweep', path: [[0, 0, -1], [0, 0, 2]], radius: 1 } },
  ],
};

describe('export_model — field solids ledger', () => {
  it('STL: the bored flange exports closed, with field_solids in mm', async () => {
    SketchRepository.create({ ref: 'sk_field_flange', title: 'bored flange', manifest: { kind: 'workbench', units: 'cm', fields: [FLANGE] } });
    const stl = await exportModelHandler({ ref: 'sk_field_flange', format: 'stl' });
    expect(stl.ok).toBe(true);
    expect(stl.triangles).toBeGreaterThan(500);
    expect(stl.closure.closed).toBe(true);
    expect(stl.field_solids.count).toBe(1);
    expect(stl.field_solids.cells).toBe(32);
    expect(stl.field_solids.edge_rounding_unit).toBe('mm');
    expect(stl.field_solids.edge_rounding).toBeCloseTo((6 / 32) * 10, 3);   // longest side 6 cm ÷ 32 cells, ×10 mm
    expect(stl.field_solids.note).toMatch(/one grid cell/);
    expect(stl.size_mm[0]).toBeGreaterThan(56);
    expect(stl.size_mm[0]).toBeLessThanOrEqual(61);
    expect(readFileSync(stl.path).length).toBe(84 + stl.triangles * 50);
  });
  it('GLB reports the rounding in world units; 3MF keeps the shell as one object', async () => {
    const glb = await exportModelHandler({ ref: 'sk_field_flange', format: 'glb', write: false });
    expect(glb.field_solids.edge_rounding_unit).toBe('cm');
    expect(glb.field_solids.edge_rounding).toBeCloseTo(6 / 32, 2);
    const mf = await exportModelHandler({ ref: 'sk_field_flange', format: '3mf', write: false });
    expect(mf.field_solids.count).toBe(1);
    expect(mf.closure.closed).toBe(true);
  });
  it('a workbench without fields carries no field_solids key; two fields list their cells', async () => {
    SketchRepository.create({ ref: 'sk_field_none', title: 'plain', manifest: { kind: 'workbench', units: 'cm', lathes: [{ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] }] } });
    const plain = await exportModelHandler({ ref: 'sk_field_none', format: 'stl', write: false });
    expect(plain.field_solids).toBeUndefined();
    SketchRepository.create({ ref: 'sk_field_two', title: 'two', manifest: { kind: 'workbench', units: 'cm', fields: [FLANGE, { ...FLANGE, cells: 24, translate: [8, 0, 0] }] } });
    const two = await exportModelHandler({ ref: 'sk_field_two', format: 'stl', write: false });
    expect(two.field_solids.count).toBe(2);
    expect(two.field_solids.cells).toEqual([32, 24]);
    expect(two.field_solids.edge_rounding).toBeCloseTo((6 / 24) * 10, 3);   // the coarsest grid speaks
  });
});
