// interchange.plan.md I3 — bind_mesh_render (the bind-back door) + the meshRef
// body source: bind an externally refined GLB onto a sketch as an append-only
// derived artifact, then place it in a world via a figures-map `meshRef` entry
// and watch it ride the whole pipeline (resolveWorldScene → export_model).

// Isolate to in-memory SQLite + a scratch outcomes dir — must run before any
// import that pulls in db/index.js (same pattern as context.test.js).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-mesh-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf.js';
import { parseGlb } from '@/lib/graph/scene/scene-gltf-read.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene.js';
import { bindMeshRenderHandler, exportModelHandler } from './sketches.js';

const scratch = mkdtempSync(path.join(os.tmpdir(), 'mojulo-mesh-scratch-'));

// A small "refined" GLB — one coloured quad, as if a Blender pass produced it.
const PROP_QUAD = {
  corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]],
  fill: '#804020',
  group: 'prop',
};
let glbPath;

beforeAll(() => {
  glbPath = path.join(scratch, 'refined.glb');
  writeFileSync(glbPath, facesToGlb({ faces: [PROP_QUAD] }, { generator: 'test' }).bytes);
});

describe('bind_mesh_render — the direct-bind tool', () => {
  it('accepts a valid GLB: append-only slot + provenance sidecar (sha256, bytes, source, date)', async () => {
    SketchRepository.create({ ref: 'sk_mesh_a', title: 'prop', manifest: { kind: 'workbench', lathes: [] } });
    const res = await bindMeshRenderHandler({ ref: 'sk_mesh_a', glb_path: glbPath, note: 'blender bevel pass' });
    expect(res.ok).toBe(true);
    expect(res.n).toBe(1);
    expect(res.triangles).toBe(2); // one quad → two written triangles
    expect(existsSync(res.path)).toBe(true);
    expect(res.path.endsWith(path.join('sk_mesh_a', 'mesh-1.glb'))).toBe(true);
    const bytes = readFileSync(res.path);
    expect(res.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    const sidecar = JSON.parse(readFileSync(`${res.path}.json`, 'utf8'));
    expect(sidecar.sha256).toBe(res.sha256);
    expect(sidecar.bytes).toBe(bytes.length);
    expect(sidecar.source_path).toBe(glbPath);
    expect(sidecar.note).toBe('blender bevel pass');
    expect(new Date(sidecar.bound_at).toISOString()).toBe(sidecar.bound_at);
  });

  it('binds append-only: a second bind lands in slot 2, slot 1 untouched', async () => {
    const res = await bindMeshRenderHandler({ ref: 'sk_mesh_a', glb_path: glbPath });
    expect(res.n).toBe(2);
    const dir = path.dirname(res.path);
    const slots = readdirSync(dir).filter((f) => /^mesh-\d+\.glb$/.test(f)).sort();
    expect(slots).toEqual(['mesh-1.glb', 'mesh-2.glb']);
  });

  it('rejects a non-GLB loudly, writing nothing', async () => {
    SketchRepository.create({ ref: 'sk_mesh_b', title: 'clean', manifest: { kind: 'workbench', lathes: [] } });
    const bad = path.join(scratch, 'not-a-mesh.glb');
    writeFileSync(bad, 'PNG-ish garbage that is definitely not glTF');
    await expect(bindMeshRenderHandler({ ref: 'sk_mesh_b', glb_path: bad })).rejects.toThrow(/not a GLB/);
    const dir = path.join(process.env.MOJULO_OUTCOMES_DIR, 'sk_mesh_b');
    expect(existsSync(dir) ? readdirSync(dir).length : 0).toBe(0);
  });

  it('rejects a structurally corrupt GLB (truncated) before touching disk', async () => {
    const good = readFileSync(glbPath);
    const cut = path.join(scratch, 'truncated.glb');
    writeFileSync(cut, good.subarray(0, good.length - 40));
    await expect(bindMeshRenderHandler({ ref: 'sk_mesh_b', glb_path: cut })).rejects.toThrow(/corrupt GLB/);
  });

  it('refuses a missing sketch', async () => {
    await expect(bindMeshRenderHandler({ ref: 'sk_mesh_nope', glb_path: glbPath })).rejects.toThrow(/not found/);
  });
});

describe('meshRef end-to-end — bound mesh placed in a world, exported back out', () => {
  const WORLD = {
    kind: 'css3d-turntable',
    shape: 'dodecahedron',
    color: '#7a5fad',
    surface: 'vexar',
    figures: {
      prop: { meshRef: 'sk_mesh_a', transform: { pos: [5, 0, 1], scale: 2 } },
    },
  };

  it('resolveWorldScene lowers the bound GLB into payload.faces with the transform baked', async () => {
    SketchRepository.create({ ref: 'sk_mesh_world', title: 'world', manifest: WORLD });
    const { payload } = await resolveWorldScene({ manifest: WORLD, title: null, ref: 'sk_mesh_world' });
    expect(payload).toBeTruthy();
    const meshFaces = payload.faces.filter((f) => f.group === 'mesh:prop');
    expect(meshFaces.length).toBe(2); // the quad's two decoded triangles
    expect(meshFaces.every((f) => f.fill === '#804020')).toBe(true);
    // corner (2,0,2) → scale 2 → (4,0,4) → +pos (9,0,5)
    const has = (p) => meshFaces.some((f) => f.corners.some((c) => c.every((v, k) => Math.abs(v - p[k]) < 1e-4)));
    expect(has([9, 0, 5])).toBe(true);
    expect(has([5, 0, 1])).toBe(true); // origin corner lands at pos
  });

  it('export_model re-exports the decoded faces as a named node', async () => {
    const res = await exportModelHandler({ ref: 'sk_mesh_world', write: false });
    expect(res.ok).toBe(true);
    const url = res.url;
    expect(url).toContain('model.glb');
    // regenerate the same GLB directly and check the mesh node rode along
    const { payload } = await resolveWorldScene({ manifest: WORLD, title: null, ref: 'sk_mesh_world' });
    const exported = facesToGlb(payload, { generator: 'test' });
    const { json } = parseGlb(exported.bytes);
    expect(json.nodes.some((n) => n.name === 'mesh:prop')).toBe(true);
    // export counts include the placed mesh (2 real + 2 degenerate pad tris)
    expect(res.triangles).toBe(exported.triangleCount);
  });

  it('a meshRef pointing at a sketch with no bound mesh refuses with the bind pointer', async () => {
    const manifest = { ...WORLD, figures: { prop: { meshRef: 'sk_mesh_b' } } };
    await expect(resolveWorldScene({ manifest, title: null })).rejects.toThrow(/bind_mesh_render/);
  });

  it('a meshRef to an unknown ref refuses', async () => {
    const manifest = { ...WORLD, figures: { prop: { meshRef: 'sk_ghost' } } };
    await expect(resolveWorldScene({ manifest, title: null })).rejects.toThrow(/not a stored sketch/);
  });
});
