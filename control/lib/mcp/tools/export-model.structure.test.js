// export_model formats 'sheets' and 'schedules' — a house as its drawing set and its schedules: written beside its
// recipe, the same bytes twice, a file per sheet and per table, the tags shared with the sheets; a non-house says why.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-structure-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';

const HOUSE = { kind: 'floorplan', storeys: 2, seed: 4, windows: true, roof: 'hip', drainage: true, furnish: true };
const FRAMED = { kind: 'floorplan', levels: [{ index: 0 }], seed: 7, windows: true, roof: { style: 'hip' }, framing: { system: 'platform' } };

describe('export_model sheets', () => {
  it('writes one SVG per sheet and an index, the same bytes twice', async () => {
    SketchRepository.create({ ref: 'sk_set_house', title: 'a set', manifest: HOUSE });
    const res = await exportModelHandler({ ref: 'sk_set_house', format: 'sheets' });
    expect(res.ok).toBe(true);
    expect(res.sheets.map((s) => s.id)).toEqual(['A-101', 'A-102', 'A-201', 'A-202', 'A-301', 'A-601', 'P-101']);
    expect(res.files).toEqual([...res.sheets.map((s) => `sheets/${s.id}.svg`), 'sheets/INDEX.md']);
    const svg = readFileSync(path.join(res.dir, 'sheets/A-101.svg'), 'utf8');
    expect(svg).toMatch(/^<svg[^>]*width="431.8mm"/);
    expect(svg).toContain('>a set<');                       // the row's title in the title block
    expect(readFileSync(res.path, 'utf8')).toContain('| A-101 |');
    const again = await exportModelHandler({ ref: 'sk_set_house', format: 'sheets' });
    expect(readFileSync(path.join(again.dir, 'sheets/A-101.svg'), 'utf8')).toBe(svg);
  });

  it('a framed house binds its S- and E-sheets', async () => {
    SketchRepository.create({ ref: 'sk_set_framed', title: 'framed', manifest: FRAMED });
    const res = await exportModelHandler({ ref: 'sk_set_framed', format: 'sheets', write: false });
    expect(res.framed).toBe(true);
    expect(res.sheets.map((s) => s.id)).toEqual(['S-101', 'S-102', 'S-103', 'A-101', 'A-201', 'A-202', 'A-301', 'A-601', 'E-101']);
    expect(res.path).toBeUndefined();
  });
});

describe('export_model sheets and schedules for a store, a restaurant, a mall', () => {
  it('draws a two-level mall level by level and schedules its fit-out', async () => {
    SketchRepository.create({ ref: 'sk_set_mall', title: 'arcade', manifest: { kind: 'mall', levels: 2 } });
    const set = await exportModelHandler({ ref: 'sk_set_mall', format: 'sheets', write: false });
    expect(set.ok).toBe(true);
    expect(set.sheets.map((s) => s.id).filter((id) => /^A-10/.test(id))).toEqual(['A-101', 'A-102']);
    expect(set.framed).toBe(false);
    const tables = await exportModelHandler({ ref: 'sk_set_mall', format: 'schedules', write: false });
    expect(tables.json.tables.find((t) => t.id === 'objects').rows.length).toBeGreaterThan(0);
  });

});

describe('export_model schedules', () => {
  it('writes a CSV per table and schedules.json, door tags as on the plan', async () => {
    SketchRepository.create({ ref: 'sk_sch_house', title: 'tables', manifest: HOUSE });
    const res = await exportModelHandler({ ref: 'sk_sch_house', format: 'schedules' });
    expect(res.ok).toBe(true);
    const ids = res.tables.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['rooms', 'doors', 'windows', 'walls', 'objects', 'checks']));
    for (const id of ids) expect(res.files).toContain(`schedules/${id}.csv`);
    const json = JSON.parse(readFileSync(res.path, 'utf8'));
    const doors = json.tables.find((t) => t.id === 'doors');
    const plan = readFileSync(path.join(res.dir, 'schedules', 'doors.csv'), 'utf8');
    expect(plan.split('\n')[0]).toBe(doors.columns.map((c) => c.label).join(','));
    expect(doors.rows.length).toBeGreaterThan(0);
    for (const r of doors.rows) expect(r[doors.columns[0].key]).toMatch(/^\d{3}[A-Z]$|^X[A-Z]$/);
  });

  it('a framed house adds its members, cut list, takeoff and the span checks it could not run', async () => {
    SketchRepository.create({ ref: 'sk_sch_framed', title: 'framed', manifest: FRAMED });
    const res = await exportModelHandler({ ref: 'sk_sch_framed', format: 'schedules', write: false });
    const ids = res.tables.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['members', 'cut-list', 'takeoff', 'circuits', 'checks']));
    const checks = res.json.tables.find((t) => t.id === 'checks').rows;
    expect(checks.find((r) => r.rule === 'span').result).toBe('NOT RUN');
  });
});

describe('not a house', () => {
  it('says why, for either format', async () => {
    SketchRepository.create({ ref: 'sk_set_box', title: 'box', manifest: { kind: 'workbench', boxes: [{ min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }] } });
    for (const format of ['sheets', 'schedules']) {
      const res = await exportModelHandler({ ref: 'sk_set_box', format });
      expect(res.ok).toBe(false);
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('mint_building');
    }
  });
});
