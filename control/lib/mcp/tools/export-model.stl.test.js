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
