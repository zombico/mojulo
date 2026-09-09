// cad-aid.plan.md phases 0+1 — the STL print handoff's hardened seams:
// studio furniture stays home, true scale derives from declared units, and the
// whole-object closure audit travels with the export (advisory, never gating).

// Isolate to in-memory SQLite + a scratch outcomes dir — must run before any
// import that pulls in db/index.js (same pattern as bind-mesh-render.test.js).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-stl-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { deriveStlScale, exportModelHandler, printProfileFor } from './sketch-model-export.js';

// A capped cylinder lathe: real end radii at both ends ⇒ flat caps ⇒ closed.
const CYLINDER = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 6 },
  profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }],
};

// Every triangle's z coordinates from a binary STL buffer.
function stlZs(buf) {
  const count = buf.readUInt32LE(80);
  const zs = [];
  for (let i = 0; i < count; i++) {
    const o = 84 + i * 50;
    for (let v = 0; v < 3; v++) zs.push(buf.readFloatLE(o + 12 + v * 12 + 8));
  }
  return zs;
}

describe('deriveStlScale', () => {
  it('maps declared unit labels to mm factors, null otherwise', () => {
    expect(deriveStlScale('cm')).toBe(10);
    expect(deriveStlScale('mm')).toBe(1);
    expect(deriveStlScale('in')).toBe(25.4);
    expect(deriveStlScale('meru')).toBeNull();
    expect(deriveStlScale(undefined)).toBeNull();
  });
});

describe('printProfileFor', () => {
  it('classifies kinds: literal parts, world maquettes, surface studies, ornament fallback', () => {
    expect(printProfileFor('workbench')).toBe('literal');
    expect(printProfileFor('carved-solid')).toBe('literal');
    expect(printProfileFor('fractal-city')).toBe('maquette');
    expect(printProfileFor('edifice')).toBe('maquette');
    expect(printProfileFor('figure')).toBe('study');
    expect(printProfileFor('manji-tree')).toBe('study');
    expect(printProfileFor('orbit-view')).toBe('ornament');
    expect(printProfileFor('some-future-kind')).toBe('ornament');
  });
});

describe('export_model stl — scale + floor + closure', () => {
  it("derives scale from units:'cm', keeps the studio floor out, audits closed", async () => {
    SketchRepository.create({
      ref: 'sk_stl_cyl',
      title: 'cylinder',
      manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] },
    });
    const res = await exportModelHandler({ ref: 'sk_stl_cyl', format: 'stl' });
    expect(res.ok).toBe(true);
    expect(res.scale).toBe(10); // derived, not agent arithmetic
    expect(res.note).toContain("units:'cm'");
    expect(res.closure).toEqual(expect.objectContaining({ audited: true, closed: true, holes: 0 }));

    const zs = stlZs(readFileSync(res.path));
    // The measured floor + grid sit BELOW the object (z < 0); their absence
    // means no vertex dips under the object's own base plane.
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(0);
    // 6 cm tall × 10 ⇒ 60 mm — true scale is structural.
    expect(Math.max(...zs)).toBeCloseTo(60, 3);

    const readme = readFileSync(path.join(res.dir, 'README.md'), 'utf8');
    expect(readme).toContain('## Print notes');
    expect(readme).toContain('scale: ×10');
    expect(readme).toContain('closure: closed');
  });

  it('explicit scale always wins over the derived one', async () => {
    const res = await exportModelHandler({ ref: 'sk_stl_cyl', format: 'stl', scale: 2, write: false });
    expect(res.scale).toBe(2);
    expect(res.note).toContain('explicit `scale` 2');
  });

  it('target_mm fits the longest dimension, overriding units derivation', async () => {
    // cylinder: 4 wide × 4 deep × 6 tall (world units) — longest 6 → ×20 for 120mm
    const res = await exportModelHandler({ ref: 'sk_stl_cyl', format: 'stl', target_mm: 120, write: false });
    expect(res.print_profile).toBe('literal');
    expect(res.scale).toBeCloseTo(20, 5);
    expect(res.size_mm[2]).toBeCloseTo(120, 1);
    expect(res.note).toContain('fit to `target_mm`');
  });

  it('reports the printed size on every stl result', async () => {
    const res = await exportModelHandler({ ref: 'sk_stl_cyl', format: 'stl', write: false });
    expect(res.size_mm).toEqual([40, 40, 60]); // 4×4×6 cm at ×10
    expect(res.note).toContain('prints 40 × 40 × 60 mm');
  });

  it('no declared units ⇒ scale 1 with an in-band nudge', async () => {
    SketchRepository.create({
      ref: 'sk_stl_bare',
      title: 'bare',
      manifest: { kind: 'workbench', lathes: [CYLINDER] },
    });
    const res = await exportModelHandler({ ref: 'sk_stl_bare', format: 'stl', write: false });
    expect(res.scale).toBe(1);
    expect(res.note).toContain('no units declared');
  });

  it('flags an open shell with hole count + widest rim, advisory only', async () => {
    SketchRepository.create({
      ref: 'sk_stl_tube',
      title: 'open tube',
      manifest: {
        kind: 'workbench',
        units: 'cm',
        sweeps: [{ path: [[0, 0, 0], [0, 0, 5]], radius: 1.5, caps: false }],
      },
    });
    const res = await exportModelHandler({ ref: 'sk_stl_tube', format: 'stl', write: false });
    expect(res.ok).toBe(true); // advisory — the export still ships
    expect(res.closure.closed).toBe(false);
    expect(res.closure.holes).toBeGreaterThanOrEqual(2); // both uncapped ends
    expect(res.closure.widest).toBeGreaterThan(0);
    expect(res.note).toContain('open rim');
  });

  it('glb export is untouched: no scale/closure fields', async () => {
    const res = await exportModelHandler({ ref: 'sk_stl_cyl', write: false });
    expect(res.ok).toBe(true);
    expect(res.format).toBe('glb');
    expect(res.scale).toBeUndefined();
    expect(res.closure).toBeUndefined();
  });
});

// continuous-guardrails.plan.md G3 + G4: declared-feature print advisories travel with every
// print export (advisory), and `strict: true` is the operator's opt-in hard stop.
describe('export_model stl — print advisories (G3) and strict (G4)', () => {
  it('a clean part reports no advisories, in the result, the note, and the README', async () => {
    SketchRepository.create({ ref: 'sk_adv_clean', title: 'cylinder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const res = await exportModelHandler({ ref: 'sk_adv_clean', format: 'stl' });
    expect(res.ok).toBe(true);
    expect(res.print_advisories).toEqual([]);
    expect(res.printer).toEqual({ process: 'fdm', nozzle_mm: 0.4, layer_mm: 0.2, min_wall_mm: 0.8, self_support_deg: 45, bed_mm: [220, 220, 250], trapped_volume: false });
    expect(res.note).toContain('Print advisories: none');
    // text-to-cad-seam T2: the measured rung rides the result, the note, and the README
    expect(res.print_measure.overhang.area_mm2).toBe(0); // a capped cylinder standing up: caps flat, walls vertical
    expect(res.print_measure.bed_contact_mm2).toBeGreaterThan(1000); // the 40 mm disc on the bed (faceted, so a little under π·20²)
    expect(res.print_measure.walls.measured).toBe(true);
    expect(res.print_measure.walls.min_mm).toBeGreaterThan(38); // across the 40 mm diameter
    expect(res.print_measure.walls.min_mm).toBeLessThanOrEqual(40);
    expect(res.print_measure.orientation.best).toBe('z+');
    expect(res.note).toContain('Measured printability: no overhang past 45°');
    const readme = readFileSync(path.join(res.dir, 'README.md'), 'utf8');
    expect(readme).toContain('print advisories (profile: FDM, 0.4 mm nozzle, 0.8 mm min wall, 45° self-support, 220 × 220 × 250 mm bed): none');
    expect(readme).toContain('- measured printability: no overhang past 45°');
  });

  it('a process profile words the advisories: SLA tightens the wall floor and the self-support angle, powder judges no overhang', async () => {
    const sla = await exportModelHandler({ ref: 'sk_adv_clean', format: 'stl', write: false, printer: { process: 'sla' } });
    expect(sla.printer.process).toBe('sla');
    expect(sla.printer.self_support_deg).toBe(30);
    expect(sla.print_measure.overhang.limit_deg).toBe(30);
    expect(sla.print_advisories.map((r) => r.kind)).toEqual(['trapped_volume']); // resin traps; stated, not measured
    const sls = await exportModelHandler({ ref: 'sk_adv_clean', format: 'stl', write: false, printer: { process: 'sls' } });
    expect(sls.print_measure.overhang).toBeNull();
    expect(sls.print_measure.orientation).toBeNull();
    expect(sls.note).toContain('overhang not judged');
    await expect(exportModelHandler({ ref: 'sk_adv_clean', format: 'stl', write: false, printer: { process: 'laser' } })).rejects.toThrow(/printer\.process/);
  });

  it('a declared wall under the floor AT THE RESOLVED SCALE is a thin_wall advisory — the file still ships', async () => {
    // a 4×3 cm tray with a 0.03 cm (0.3 mm) wall: under the 0.8 mm two-perimeter floor at ×10
    const TRAY = { profile: { rect: { w: 4, h: 3 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, wallThickness: 0.03 };
    SketchRepository.create({ ref: 'sk_adv_thin', title: 'tray', manifest: { kind: 'workbench', units: 'cm', extrudes: [TRAY] } });
    const res = await exportModelHandler({ ref: 'sk_adv_thin', format: 'stl' });
    expect(res.ok).toBe(true); // advisory — the export still ships
    // rung 1 (declared) and rung 2 (sampled) both see the 0.3 mm wall; the closed shell's
    // cavity ceiling is a real bridge, reported as the overhang it is
    expect(res.print_advisories.map((r) => r.kind)).toEqual(['thin_wall', 'thin_wall_measured', 'overhang']);
    expect(res.print_advisories[0].mm).toBeCloseTo(0.3, 5);
    expect(res.print_advisories[1].mm).toBeCloseTo(0.3, 1);
    expect(res.print_measure.walls.measured).toBe(true);
    expect(res.print_measure.overhang.worst_deg).toBe(90);
    expect(res.note).toContain('Print advisories (3): thin_wall');
    const readme = readFileSync(path.join(res.dir, 'README.md'), 'utf8');
    expect(readme).toContain('  - thin_wall: extrudes[0].wallThickness prints 0.3 mm thick');
    // a coarser printer profile words it differently; a finer one clears it
    const coarse = await exportModelHandler({ ref: 'sk_adv_thin', format: 'stl', write: false, printer: { nozzle_mm: 0.6 } });
    expect(coarse.print_advisories[0].detail).toContain('1.2 mm two-perimeter floor');
    const fine = await exportModelHandler({ ref: 'sk_adv_thin', format: 'stl', write: false, printer: { nozzle_mm: 0.1 } });
    expect(fine.print_advisories.map((r) => r.kind)).toEqual(['overhang']); // the walls clear a 0.2 mm floor; the ceiling is still a bridge
  });

  it('over_bed fires on the exported size; a bigger declared bed clears it', async () => {
    const res = await exportModelHandler({ ref: 'sk_adv_clean', format: 'stl', write: false, scale: 100 }); // 400 × 400 × 600 mm
    expect(res.print_advisories.map((r) => r.kind)).toEqual(['over_bed']);
    expect(res.print_advisories[0].detail).toContain('on x, y, z');
    const big = await exportModelHandler({ ref: 'sk_adv_clean', format: 'stl', write: false, scale: 100, printer: { bed_mm: [500, 500, 700] } });
    expect(big.print_advisories).toEqual([]);
  });

  it('strict refuses an open shell or an advisory and writes NOTHING; the default ships it', async () => {
    const OPEN_TUBE = { ...CYLINDER, caps: false };
    SketchRepository.create({ ref: 'sk_strict_open', title: 'tube', manifest: { kind: 'workbench', units: 'cm', lathes: [OPEN_TUBE] } });
    const lax = await exportModelHandler({ ref: 'sk_strict_open', format: 'stl' });
    expect(lax.ok).toBe(true);
    expect(lax.closure.closed).toBe(false);
    await expect(exportModelHandler({ ref: 'sk_strict_open', format: 'stl', strict: true })).rejects.toThrow(/strict: refusing to write model\.stl .*closure: 2 open rims/);
    await expect(exportModelHandler({ ref: 'sk_adv_thin', format: 'stl', strict: true })).rejects.toThrow(/thin_wall/);
    // a clean part passes strict and writes
    const ok = await exportModelHandler({ ref: 'sk_adv_clean', format: 'stl', strict: true });
    expect(ok.ok).toBe(true);
  });

  it('strict and printer are print-format knobs', async () => {
    await expect(exportModelHandler({ ref: 'sk_adv_clean', format: 'glb', strict: true })).rejects.toThrow(/print formats/);
    await expect(exportModelHandler({ ref: 'sk_adv_clean', format: 'glb', printer: { nozzle_mm: 0.6 } })).rejects.toThrow(/print formats/);
    await expect(exportModelHandler({ ref: 'sk_adv_clean', format: 'stl', printer: { nozzle_mm: -1 } })).rejects.toThrow(/nozzle_mm/);
  });
});

// continuous-guardrails.plan.md G6: the ledger the mint wrote travels into the export.
import { createWorkbenchHandler } from './workbench.js';
describe('export_model stl — the ledger travels (G6)', () => {
  it('a minted workbench carries its ledger into the result and README; a declared-open lathe reads as lint-closed / audit-open', async () => {
    await createWorkbenchHandler({ title: 'tube', ref: 'sk_ledger_tube', units: 'cm', lathes: [{ ...CYLINDER, caps: false }] });
    const res = await exportModelHandler({ ref: 'sk_ledger_tube', format: 'stl' });
    expect(res.ok).toBe(true);
    expect(res.ledger).toEqual({ recipe_bytes: expect.any(Number), faces: expect.any(Number), closed: true }); // caps:false is a declared intent the lint excuses
    expect(res.closure.closed).toBe(false);                                                                     // the whole-object audit does not
    const readme = readFileSync(path.join(res.dir, 'README.md'), 'utf8');
    expect(readme).toMatch(/- ledger at last mint\/edit: \d+ faces, recipe \d+ bytes, per-monomer lint closed — the whole-object audit above finds open rims the per-monomer lint excused/);
  });
  it('a hand-created manifest (no mint) carries no ledger line', async () => {
    const res = await exportModelHandler({ ref: 'sk_stl_cyl', format: 'stl' });
    expect(res.ledger).toBeUndefined();
    expect(readFileSync(path.join(res.dir, 'README.md'), 'utf8')).not.toContain('ledger at last mint');
  });
});
