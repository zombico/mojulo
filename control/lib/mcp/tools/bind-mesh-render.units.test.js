// text-to-cad-seam.plan.md T4 — the return door for a STEP-born part: a millimetre GLB from a
// CAD tool lands in a cm workbench at the right size via `units`, the conversion rides the
// sidecar (bytes untouched), every meshRef placement inherits it, and `expected_box` runs the
// 0.5×–2× size gate the worker path already had.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-mesh-units-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene.js';
import { describeBoundMeshes } from '@/lib/graph/scene/mesh-store.js';
import { bindMeshRenderHandler } from './sketches.js';

const scratch = mkdtempSync(path.join(os.tmpdir(), 'mojulo-mesh-units-scratch-'));

// A 40 × 40 × 40 "bracket" written in MILLIMETRES, the way a CAD tool's GLB export is —
// six outward quads, z-up in mojulo's face-list frame (facesToGlb writes the y-up file).
function boxFaces(s) {
  const q = (a, b, c, d) => ({ corners: [a, b, c, d], fill: '#9aa0a6', group: 'bracket' });
  const [x0, y0, z0, x1, y1, z1] = [0, 0, 0, s, s, s];
  return [
    q([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]),
    q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]),
    q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]),
    q([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]),
    q([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]),
    q([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]),
  ];
}
let glbPath;
const sizeOf = (faces) => {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], c[k]); mx[k] = Math.max(mx[k], c[k]); }
  return mx.map((v, k) => Math.round((v - mn[k]) * 1000) / 1000);
};

beforeAll(() => {
  glbPath = path.join(scratch, 'bracket-mm.glb');
  writeFileSync(glbPath, facesToGlb({ faces: boxFaces(40) }, { generator: 'cadgen-style test' }).bytes);
});

describe('bind_mesh_render — units (T4)', () => {
  it('a 40 mm GLB bound with units:"mm" into a cm workbench lands as a 4 cm box; the sidecar carries the factor, the bytes do not', async () => {
    SketchRepository.create({ ref: 'sk_cad_part', title: 'bracket', manifest: { kind: 'workbench', units: 'cm', lathes: [] } });
    const res = await bindMeshRenderHandler({ ref: 'sk_cad_part', glb_path: glbPath, units: 'mm', source: 'text-to-cad/cadgen@0.5.0' });
    expect(res.ok).toBe(true);
    expect(res.source_units).toBe('mm');
    expect(res.scale_applied).toBeCloseTo(0.1, 9);
    expect(res.next).toContain('×0.1');
    expect(res.next).toContain('B-rep exactness does not travel');
    // bytes untouched: the stored file IS the CAD file
    const stored = readFileSync(res.path);
    expect(createHash('sha256').update(stored).digest('hex')).toBe(createHash('sha256').update(readFileSync(glbPath)).digest('hex'));
    const sidecar = JSON.parse(readFileSync(`${res.path}.json`, 'utf8'));
    expect(sidecar.source_units).toBe('mm');
    expect(sidecar.scale_applied).toBeCloseTo(0.1, 9);
    expect(sidecar.source).toBe('text-to-cad/cadgen@0.5.0');
    const described = describeBoundMeshes('sk_cad_part');
    expect(described[0].scale_applied).toBeCloseTo(0.1, 9);
    expect(described[0].source_units).toBe('mm');

    // placed in a cm world by meshRef, the bracket is 4 × 4 × 4 world units (cm) — not 40
    SketchRepository.create({ ref: 'sk_cad_world', title: 'bench', manifest: { kind: 'workbench', units: 'cm', lathes: [], figures: { part: { meshRef: 'sk_cad_part' } } } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_cad_world'));
    const meshFaces = payload.faces.filter((f) => String(f.group || '').startsWith('mesh:part'));
    expect(meshFaces.length).toBeGreaterThan(0);
    expect(sizeOf(meshFaces)).toEqual([4, 4, 4]);

    // the placement's own transform.scale composes with the unit factor
    SketchRepository.create({ ref: 'sk_cad_world2', title: 'bench2', manifest: { kind: 'workbench', units: 'cm', lathes: [], figures: { part: { meshRef: 'sk_cad_part', transform: { scale: 2, pos: [10, 0, 0] } } } } });
    const r2 = await resolveWorldScene(SketchRepository.getByRef('sk_cad_world2'));
    expect(sizeOf(r2.payload.faces.filter((f) => String(f.group || '').startsWith('mesh:part')))).toEqual([8, 8, 8]);
  });

  it('without units the same bytes land as a 40-unit box — today\'s behaviour, pinned', async () => {
    SketchRepository.create({ ref: 'sk_cad_plain', title: 'bracket', manifest: { kind: 'workbench', units: 'cm', lathes: [] } });
    const res = await bindMeshRenderHandler({ ref: 'sk_cad_plain', glb_path: glbPath });
    expect(res.scale_applied).toBeUndefined();
    const sidecar = JSON.parse(readFileSync(`${res.path}.json`, 'utf8'));
    expect(sidecar.scale_applied).toBeUndefined();
    SketchRepository.create({ ref: 'sk_cad_plain_world', title: 'bench', manifest: { kind: 'workbench', units: 'cm', lathes: [], figures: { part: { meshRef: 'sk_cad_plain' } } } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef('sk_cad_plain_world'));
    expect(sizeOf(payload.faces.filter((f) => String(f.group || '').startsWith('mesh:part')))).toEqual([40, 40, 40]);
  });

  it('expected_box runs the size gate: the CAD tool\'s own bbox agrees, a ×10 slip does not; a bare scale beats units', async () => {
    SketchRepository.create({ ref: 'sk_cad_gate', title: 'bracket', manifest: { kind: 'workbench', units: 'cm', lathes: [] } });
    const ok = await bindMeshRenderHandler({ ref: 'sk_cad_gate', glb_path: glbPath, units: 'mm', expected_box: { min: [0, 0, 0], max: [40, 40, 40] } });
    expect(ok.machine.size_agrees).toBe(true);
    expect(ok.machine.size_file_units).toEqual([40, 40, 40]);
    const slip = await bindMeshRenderHandler({ ref: 'sk_cad_gate', glb_path: glbPath, units: 'mm', expected_box: { min: [0, 0, 0], max: [4, 4, 4] } });
    expect(slip.machine.size_agrees).toBe(false);
    expect(slip.next).toContain('SIZE GATE FAILED');
    const explicit = await bindMeshRenderHandler({ ref: 'sk_cad_gate', glb_path: glbPath, units: 'mm', scale: 0.25 });
    expect(explicit.scale_applied).toBe(0.25);
    expect(explicit.source_units).toBe('mm');
  });

  it('refuses what it cannot convert: an unknown unit, a sketch with no declared unit, a malformed box', async () => {
    SketchRepository.create({ ref: 'sk_cad_nounits', title: 'x', manifest: { kind: 'fractal-city', seed: 1 } });
    await expect(bindMeshRenderHandler({ ref: 'sk_cad_part', glb_path: glbPath, units: 'furlong' })).rejects.toThrow(/units/);
    await expect(bindMeshRenderHandler({ ref: 'sk_cad_nounits', glb_path: glbPath, units: 'mm' })).rejects.toThrow(/declares no unit/);
    await expect(bindMeshRenderHandler({ ref: 'sk_cad_part', glb_path: glbPath, expected_box: { min: [0, 0] } })).rejects.toThrow(/expected_box/);
    await expect(bindMeshRenderHandler({ ref: 'sk_cad_part', glb_path: glbPath, scale: -1 })).rejects.toThrow(/scale/);
  });
});
