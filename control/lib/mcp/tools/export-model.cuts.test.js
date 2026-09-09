// parts-booleans.plan.md B1/B2/B4 — a `cuts[]` recipe leaves through the print door as ONE closed
// field part: the export ledger names the cut, measure_solid reads its genus, the advisory calls
// a fine bore a hole, and update_sketch moving a bore re-cuts because the recipe stores the cut.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-cuts-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { exportModelHandler } from './sketch-model-export.js';
import { measureSolidHandler } from './measure-solid.js';
import { createWorkbenchHandler } from './workbench.js';
import { updateSketchHandler } from './sketches.js';
import { lowerObjectFaces } from '@/lib/graph/worlds/workbench';

const flange = { id: 'flange', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1.2 }, profile: [{ t: 0, radius: 6 }, { t: 1, radius: 6 }], material: 'steel' };
const bore = (id, x, y, r) => ({ id, path: [[x, y, -1], [x, y, 3]], radius: r });
const RECIPE = {
  title: 'bored flange', ref: 'sk_cut_flange', units: 'cm',
  lathes: [flange],
  sweeps: [bore('bore', 0, 0, 1.2), bore('b1', 4.5, 0, 0.45), bore('b2', -4.5, 0, 0.45), bore('b3', 0, 4.5, 0.45)],
  cuts: [{ id: 'bolts', from: 'flange', subtract: ['bore', 'b1', 'b2', 'b3'], cells: 48 }],
};

describe('cuts — the print door', () => {
  it('mints as a recipe that STORES the cut (monomers unlowered), reads out as one part, warns about the rounding', async () => {
    const r = await createWorkbenchHandler(RECIPE);
    expect(r.ok).toBe(true);
    const stored = SketchRepository.getByRef('sk_cut_flange').manifest;
    expect(stored.cuts).toEqual(RECIPE.cuts);
    expect(stored.lathes).toHaveLength(1);
    expect(stored.sweeps).toHaveLength(4);
    expect(stored.fields).toBeUndefined();
    expect(r.stats.monomers).toBe(1);
    expect(r.stats.parts).toHaveLength(1);
    expect(r.stats.parts[0]).toMatchObject({ kind: 'field', cut: 'bolts', from: 'flange' });
    expect(r.stats.parts[0].open).toBeUndefined();
    expect(r.stats.cuts).toEqual([{ id: 'bolts', from: 'flange', subtract: ['bore', 'b1', 'b2', 'b3'], cells: 48, edge_round: expect.any(Number) }]);
    expect(r.stats.cuts[0].edge_round).toBeCloseTo(12 / 48, 2);
    expect(r.stats.warnings.some((w) => /cut 'bolts' \(flange subtract bore, b1, b2, b3\) rounds every edge to about 0\.25 cm \(48 cells\)/.test(w))).toBe(true);
    expect(r.stats.ledger.closed).toBe(true);
  });

  it('exports closed as 3MF and STL; the ledger names the cut; Manifold reads genus 4', async () => {
    const mf = await exportModelHandler({ ref: 'sk_cut_flange', format: '3mf', write: false });
    expect(mf.ok).toBe(true);
    expect(mf.closure.closed).toBe(true);
    expect(mf.field_solids.count).toBe(1);
    expect(mf.field_solids.cells).toBe(48);
    expect(mf.field_solids.cuts).toEqual([{ id: 'bolts', from: 'flange', subtract: ['bore', 'b1', 'b2', 'b3'], cells: 48, edge_rounding: expect.any(Number) }]);
    expect(mf.field_solids.cuts[0].edge_rounding).toBeCloseTo((12 / 48) * 10, 2);   // mm on the print format
    const stl = await exportModelHandler({ ref: 'sk_cut_flange', format: 'stl' });
    expect(stl.closure.closed).toBe(true);
    expect(stl.size_mm[0]).toBeGreaterThan(116);
    expect(stl.size_mm[0]).toBeLessThanOrEqual(122);
    expect(readFileSync(stl.path).length).toBe(84 + stl.triangles * 50);
    const m = await measureSolidHandler({ ref: 'sk_cut_flange' });
    expect(m.ok).toBe(true);
    expect(m.cuts).toHaveLength(1);
    expect(m.parts[0].cut).toBe('bolts');
    if (m.volume.applied) {
      expect(m.volume.genus).toBe(4);   // the centre bore + three bolt holes
      expect(m.volume.unioned).toBe(1);
    }
  });

  it('the advisory calls a bore too fine a HOLE that closes up, and leaves a printable bore alone', async () => {
    await createWorkbenchHandler({
      ...RECIPE, ref: 'sk_cut_pin', units: 'mm',
      lathes: [{ ...flange, axisTo: { x: 0, y: 0, z: 12 }, profile: [{ t: 0, radius: 20 }, { t: 1, radius: 20 }] }],
      sweeps: [bore('bore', 0, 0, 3), { id: 'pin', path: [[8, 0, -1], [8, 0, 14]], radius: 0.25 }],
      cuts: [{ from: 'flange', subtract: ['bore', 'pin'], cells: 32 }],
    });
    const m = await measureSolidHandler({ ref: 'sk_cut_pin' });
    const tiny = m.print_advisories.filter((a) => a.kind === 'tiny_feature');
    expect(tiny).toHaveLength(1);
    expect(tiny[0].at).toBe("sweeps[1].radius (bore 'pin')");
    expect(tiny[0].detail).toMatch(/is a hole 0\.5 mm across .* will close up or print as a pinhole/);
    expect(m.print_advisories.some((a) => /bore 'bore'/.test(a.at || ''))).toBe(false);
  });

  it('update_sketch moving a bore re-cuts in place: the recipe keeps the cut, the faces move', async () => {
    const before = SketchRepository.getByRef('sk_cut_flange').manifest;
    const facesBefore = lowerObjectFaces(before);
    const edited = { ...before, sweeps: before.sweeps.map((s) => (s.id === 'b3' ? bore('b3', 0, -4.5, 0.45) : s)) };
    const r = await updateSketchHandler({ ref: 'sk_cut_flange', manifest: edited });
    expect(r.ok).toBe(true);
    const after = SketchRepository.getByRef('sk_cut_flange').manifest;
    expect(after.cuts).toEqual(RECIPE.cuts);
    expect(after.fields).toBeUndefined();
    expect(after.sweeps.find((s) => s.id === 'b3').path[0]).toEqual([0, -4.5, -1]);
    const facesAfter = lowerObjectFaces(after);
    expect(new Set(facesAfter.map((f) => f.group))).toEqual(new Set(['flange', 'bore', 'b1', 'b2', 'b3']));
    const b3Before = facesBefore.filter((f) => f.group === 'b3').map((f) => f.corners[0][1]);
    const b3After = facesAfter.filter((f) => f.group === 'b3').map((f) => f.corners[0][1]);
    expect(Math.max(...b3Before)).toBeGreaterThan(3);    // the hole was at +y
    expect(Math.min(...b3After)).toBeLessThan(-3);       // and is now at −y
    // a bad edit is refused with the id, like at mint
    await expect(updateSketchHandler({ ref: 'sk_cut_flange', manifest: { ...after, cuts: [{ from: 'flange', subtract: ['nope'] }] } })).rejects.toThrow(/cuts\[0\]\.subtract 'nope'/);
  });
});
