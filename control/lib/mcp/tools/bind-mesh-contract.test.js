// export-blender.plan.md B1 — the return door: a bound GLB is measured against the
// sketch's Blender pack (contract drift, advisory), its provenance carries the head
// manifest hash (staleness derives from it), albedo textures come home and ride a
// meshRef world's payload.textures (seam 6b).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-contract-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf.js';
import { glbToScene } from '@/lib/graph/scene/scene-gltf-read.js';
import { describeBoundMeshes } from '@/lib/graph/scene/mesh-store.js';
import { buildBlenderPack } from '@/lib/graph/scene/blender-pack.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene.js';
import { bindMeshRenderHandler } from './sketches.js';

const CYLINDER = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };
const SPOUT = { axisFrom: { x: 3, y: 0, z: 3 }, axisTo: { x: 6, y: 0, z: 4 }, profile: [{ t: 0, radius: 0.6 }, { t: 1, radius: 0.4 }] };
const PNG_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const scratch = mkdtempSync(path.join(os.tmpdir(), 'mojulo-contract-scratch-'));
const REF = 'sk_rc_cup';
const packDir = () => path.join(process.env.MOJULO_OUTCOMES_DIR, REF, 'blender');

describe('the return door (B1)', () => {
  it('a bind with no pack: provenance carries manifest_hash, no contract block', async () => {
    SketchRepository.create({ ref: 'sk_rc_plain', title: 'plain', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const glb = path.join(scratch, 'plain.glb');
    writeFileSync(glb, facesToGlb({ faces: [{ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#804020', group: 'prop' }] }, { generator: 't' }).bytes);
    const res = await bindMeshRenderHandler({ ref: 'sk_rc_plain', glb_path: glb, source: 'blender-artpass' });
    expect(res.ok).toBe(true);
    expect(res.manifest_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(res.contract).toBeUndefined();
    expect(res.textures).toEqual([]);
    const sidecar = JSON.parse(readFileSync(`${res.path}.json`, 'utf8'));
    expect(sidecar.manifest_hash).toBe(res.manifest_hash);
    expect(sidecar.source).toBe('blender-artpass');
    expect(sidecar.contract).toBeUndefined();
  });

  it('the pack\'s own GLB back: contract measured, no drift; a moved part returns `moved` rows and STILL binds', async () => {
    SketchRepository.create({ ref: REF, title: 'cup', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER, SPOUT] } });
    const pack = await buildBlenderPack({ ref: REF, outDir: packDir() });
    expect(pack.pack.nodes.length).toBeGreaterThanOrEqual(1);

    const own = await bindMeshRenderHandler({ ref: REF, glb_path: path.join(packDir(), 'model.glb'), source: 'blender-artpass', note: 'the pack itself' });
    expect(own.ok).toBe(true);
    expect(own.contract.ok).toBe(true);
    expect(own.contract.contract_drift).toEqual([]);
    expect(own.contract.pack_manifest_hash).toBe(pack.manifestHash);
    expect(own.contract.pack_stale).toBe(false);
    expect(own.next).toMatch(/no drift/);

    // a "hand pass" that moved the whole form +3 on x (form change: belongs upstream)
    const scene = glbToScene(readFileSync(path.join(packDir(), 'model.glb')));
    const moved = scene.faces.map((f) => ({ ...f, group: f.group, corners: f.corners.map((c) => [c[0] + 3, c[1], c[2]]) }));
    // keep the pack's node names so the drift is about BOUNDS, not names
    const byNode = pack.pack.nodes.map((n) => n.name);
    const named = moved.map((f) => ({ ...f, group: byNode[0] }));
    const glb = path.join(scratch, 'moved.glb');
    writeFileSync(glb, facesToGlb({ faces: named }, { generator: 't' }).bytes);
    const res = await bindMeshRenderHandler({ ref: REF, glb_path: glb, source: 'blender-artpass', note: 'moved' });
    expect(res.ok).toBe(true); // advise, never refuse
    expect(res.n).toBe(own.n + 1);
    expect(res.contract.ok).toBe(false);
    expect(res.contract.contract_drift.some((d) => d.kind === 'moved')).toBe(true);
    expect(res.next).toMatch(/CONTRACT DRIFT/);
    const sidecar = JSON.parse(readFileSync(`${res.path}.json`, 'utf8'));
    expect(sidecar.contract.contract_drift.length).toBe(res.contract.contract_drift.length);
  });

  it('staleness derives from the sidecar\'s manifest hash once the recipe re-mints', async () => {
    const before = describeBoundMeshes(REF, { manifestHash: (await bindMeshRenderHandler({ ref: REF, glb_path: path.join(packDir(), 'model.glb'), source: 'blender-artpass' })).manifest_hash });
    expect(before.length).toBeGreaterThanOrEqual(3);
    expect(before.every((b) => b.stale === false)).toBe(true);
    expect(before[before.length - 1].contract_ok).toBe(true);
    const sk = SketchRepository.getByRef(REF);
    SketchRepository.update({ ref: REF, title: sk.title, manifest: { ...sk.manifest, lathes: [CYLINDER] } });
    const after = await bindMeshRenderHandler({ ref: REF, glb_path: path.join(packDir(), 'model.glb'), source: 'blender-artpass' });
    expect(after.contract.pack_stale).toBe(true); // the pack predates the recipe now
    const listed = describeBoundMeshes(REF, { manifestHash: after.manifest_hash });
    expect(listed.slice(0, -1).every((b) => b.stale === true)).toBe(true);
    expect(listed[listed.length - 1].stale).toBe(false);
    expect(describeBoundMeshes(REF)[0].stale).toBeNull(); // unknown head ⇒ null, never a guess
  });

  it('a textured return comes home and rides a meshRef world\'s payload.textures (seam 6b)', async () => {
    SketchRepository.create({ ref: 'sk_rc_tex', title: 'tex', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const faces = [
      { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#ff0000', group: 'static' },
      { corners: [[4, 0, 0], [6, 0, 0], [6, 0, 2], [4, 0, 2]], fill: '#808080', group: 'static', texture: 'paint', uv: UV },
    ];
    const glb = path.join(scratch, 'painted.glb');
    writeFileSync(glb, facesToGlb({ faces, textures: { paint: PNG_URL } }, { generator: 't' }).bytes);
    const res = await bindMeshRenderHandler({ ref: 'sk_rc_tex', glb_path: glb, source: 'blender-artpass', note: 'recolour + one painted panel' });
    expect(res.textures).toEqual(['paint']);
    expect(res.next).toMatch(/1 albedo texture carried \(paint\)/);
    const WORLD = { kind: 'css3d-turntable', shape: 'dodecahedron', color: '#7a5fad', surface: 'vexar', figures: { hero: { meshRef: 'sk_rc_tex' } } };
    SketchRepository.create({ ref: 'sk_rc_world', title: 'w', manifest: WORLD });
    const { payload } = await resolveWorldScene({ manifest: WORLD, title: null, ref: 'sk_rc_world' });
    const mesh = payload.faces.filter((f) => f.group === 'mesh:hero');
    expect(mesh.some((f) => f.fill === '#ff0000')).toBe(true); // the recolour
    expect(mesh.filter((f) => f.texture === 'paint').length).toBe(2); // the painted panel
    expect(payload.textures.paint).toBe(PNG_URL); // the image rides the world
  });
});
