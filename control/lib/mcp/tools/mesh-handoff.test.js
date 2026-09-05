// interchange-seams.plan.md seam 5 — the mesh handoff rides the image handoff's
// durable table with medium 'mesh': neither queue sees the other; submit runs the
// machine gates (decode, size vs greybox, closure) and stores through the shared
// bind-back slot; accept refuses self-accept and a failed size gate.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-mesh-handoff-'));

import { getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { RenderRequestRepository } from '@/lib/db/repositories/render-requests';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { latestBoundMesh } from '@/lib/graph/scene/mesh-store';
import {
  requestMeshRenderHandler, pullMeshRenderHandler, submitMeshRenderHandler, acceptMeshRenderHandler, rejectMeshRenderHandler,
} from './mesh-handoff.js';

const CYLINDER = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 }, profile: [{ t: 0, radius: 2 }, { t: 1, radius: 2 }] };

describe('mesh handoff', () => {
  it('migration: the table carries medium, defaulting old rows to image', () => {
    const cols = getDb().prepare('PRAGMA table_info(image_render_requests)').all().map((c) => c.name);
    expect(cols).toContain('medium');
    const img = RenderRequestRepository.park({ ref: 'sk_img', target: 'page', kind: 'image-outcome', manifestHash: 'aaaa' });
    expect(img.medium).toBe('image');
  });

  it('request → pull → submit → accept, with the image queue blind to mesh rows', async () => {
    SketchRepository.create({ ref: 'sk_mesh_cyl', title: 'cylinder', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const req = await requestMeshRenderHandler({ ref: 'sk_mesh_cyl' });
    expect(req.ok).toBe(true);
    expect(req.status).toBe('pending');
    // idempotent per head manifest
    expect((await requestMeshRenderHandler({ ref: 'sk_mesh_cyl' })).request_id).toBe(req.request_id);
    // the image worker's queue does not see it (the only image row is the one parked above)
    const imageClaim = RenderRequestRepository.claimNext({});
    expect(imageClaim?.id).not.toBe(req.request_id);
    expect(imageClaim?.medium ?? 'image').toBe('image');
    expect(RenderRequestRepository.listPending({ medium: 'mesh' }).map((r) => r.id)).toContain(req.request_id);

    const pulled = await pullMeshRenderHandler({});
    expect(pulled.request_id).toBe(req.request_id);
    expect(pulled.status).toBe('in_flight');
    expect(pulled.submit_tool).toBe('submit_mesh_render');
    expect(existsSync(pulled.greybox.path)).toBe(true);
    expect(pulled.size_world_units).toEqual([4, 4, 6]);
    expect(pulled.units).toBe('cm');
    expect(pulled.instructions).toContain('4 × 4 × 6 cm');
    expect(await pullMeshRenderHandler({})).toMatchObject({ request: null });

    // the "sculpted" mesh: hand the greybox back (a valid GLB at the right size)
    const sub = await submitMeshRenderHandler({ request_id: req.request_id, glb_path: pulled.greybox.path, worker_audit: { invoked_generator: true, generator: 'test' }, source: 'worker-a' });
    expect(sub.ok).toBe(true);
    expect(sub.status).toBe('submitted');
    expect(sub.machine.size_agrees).toBe(true);
    expect(sub.machine.closure.closed).toBe(true);
    expect(sub.n).toBe(1);
    expect(existsSync(sub.path)).toBe(true);
    const sidecar = JSON.parse(readFileSync(`${sub.path}.json`, 'utf8'));
    expect(sidecar.source).toBe('worker-a');
    expect(sidecar.sha256).toBe(sub.sha256);

    await expect(acceptMeshRenderHandler({ request_id: req.request_id, source: 'worker-a' })).rejects.toThrow(/self-accept/);
    const acc = await acceptMeshRenderHandler({ request_id: req.request_id, accept_audit: { read: 'silhouette holds' }, source: 'operator' });
    expect(acc.status).toBe('accepted');
    expect(acc.mesh.n).toBe(1);
    expect(latestBoundMesh('sk_mesh_cyl').n).toBe(1);
    expect(RenderRequestRepository.getById(req.request_id).acceptAudit.acceptedBy).toBe('operator');
  });

  it('submit refuses non-GLB bytes and flags a wrong-size return; accept refuses it until overridden', async () => {
    SketchRepository.create({ ref: 'sk_mesh_two', title: 'two', manifest: { kind: 'workbench', units: 'cm', lathes: [CYLINDER] } });
    const req = await requestMeshRenderHandler({ ref: 'sk_mesh_two' });
    const pulled = await pullMeshRenderHandler({ ref: 'sk_mesh_two' });
    expect(pulled.request_id).toBe(req.request_id);
    await expect(submitMeshRenderHandler({ request_id: req.request_id, glb_base64: Buffer.from('not a glb').toString('base64') })).rejects.toThrow();
    // a 10× cube instead of the 4×4×6 cylinder
    const big = facesToGlb({ faces: [{ corners: [[0, 0, 0], [40, 0, 0], [40, 40, 0], [0, 40, 0]], fill: '#888' }, { corners: [[0, 0, 0], [40, 0, 0], [40, 0, 60], [0, 0, 60]], fill: '#888' }] });
    const sub = await submitMeshRenderHandler({ request_id: req.request_id, glb_base64: big.bytes.toString('base64'), source: 'worker-b' });
    expect(sub.machine.size_agrees).toBe(false);
    expect(sub.next).toContain('SIZE GATE FAILED');
    await expect(acceptMeshRenderHandler({ request_id: req.request_id, source: 'operator' })).rejects.toThrow(/size gate/);
    const rej = await rejectMeshRenderHandler({ request_id: req.request_id, accept_audit: { reason: 'ten times too big' } });
    expect(rej.status).toBe('rejected');
    // re-submit is allowed against the same request
    const again = await submitMeshRenderHandler({ request_id: req.request_id, glb_path: pulled.greybox.path, source: 'worker-b' });
    expect(again.machine.size_agrees).toBe(true);
    expect(again.n).toBe(2);
  });

  it('refuses a sketch with no World form', async () => {
    SketchRepository.create({ ref: 'sk_mesh_flat', title: 'flat', manifest: { kind: 'flow', nodes: [] } });
    await expect(requestMeshRenderHandler({ ref: 'sk_mesh_flat' })).rejects.toThrow(/no World geometry/);
  });
});
