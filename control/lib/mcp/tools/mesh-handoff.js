/**
 * The mesh handoff (interchange-seams.plan.md seam 5) — the durable MESH-worker
 * seam, the sibling of render-handoff.js on the SAME table, built as a bicycle
 * (docs/bicycles.md).
 *
 * mojulo designs an object but cannot sculpt high-frequency form; an external
 * image/text-to-mesh worker can (Meshy, Tripo, Rodin in the cloud; Hunyuan3D,
 * TripoSR locally). `bind_mesh_render` is the MANUAL half of that loop — this is
 * the durable half, drivable cold:
 *
 *   request_mesh_render  → park one durable row per sketch (medium 'mesh')
 *   pull_mesh_render     → claim the oldest pending row + the packet: the greybox
 *                          GLB (the shape prior), the still + turntable URLs, the
 *                          declared size, the triangle budget, the instructions
 *   submit_mesh_render   → the MACHINE gate: GLB-validated + decoded at the door,
 *                          closure audited, bounds checked against the greybox
 *                          (a mesh that came back at 10× or mirrored fails loudly),
 *                          then stored through the SAME append-only mesh slot
 *                          bind_mesh_render uses, with a provenance sidecar
 *   accept_/reject_mesh_render → the EYES gate; the same worker cannot self-accept
 *
 * Every response names the NEXT action (bicycle property 1). Rows ride
 * `image_render_requests` with `medium = 'mesh'` — the repository is medium-
 * agnostic and the image tools default to 'image', so neither queue sees the
 * other. Worker keys live in the OPERATOR's worker script, never here
 * (docs/local-mesh-worker.md, the ComfyUI posture).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { RenderRequestRepository } from '@/lib/db/repositories/render-requests';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToStl, isPrintableFace } from '@/lib/graph/scene/scene-stl';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes-paths';
import { glbToFaces } from '@/lib/graph/scene/scene-gltf-read';
import { auditClosure } from '@/lib/graph/polygonizer/face-closure';
import { latestBoundMesh } from '@/lib/graph/scene/mesh-store';
import { bindMeshBytes, printProfileFor } from '@/lib/mcp/tools/sketch-model-export';
import { createHash } from 'node:crypto';

const MEDIUM = 'mesh';
const TARGET = 'mesh';

function manifestHash(manifest) {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 16);
}

// The sketch must have a traversable World form — the greybox IS the packet.
async function resolveMeshSubject(ref) {
  if (!ref || typeof ref !== 'string') throw new Error('requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (!sketch.manifest) throw new Error(`Sketch '${ref}' has no manifest`);
  const { payload, kind } = await resolveWorldScene(sketch);
  if (!payload) {
    throw new Error(`Sketch '${ref}' (kind '${sketch.manifest.kind}') has no World geometry to greybox — mesh handoff covers the object / figure / world kinds export_model covers.`);
  }
  return { sketch, payload, kind: kind ?? sketch.manifest.kind, ref: sketch.ref || ref };
}

// Printable-set bounds in world units — the size the returned mesh must agree with.
function greyboxSize(payload) {
  const probe = facesToStl(payload, { scale: 1 });
  return probe ? probe.bounds : null;
}

function boundsOfFaces(faces) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < min[k]) min[k] = c[k]; if (c[k] > max[k]) max[k] = c[k]; }
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

export async function requestMeshRenderHandler(input) {
  const { ref } = input || {};
  const { sketch, kind, ref: sketchRef } = await resolveMeshSubject(ref);
  const request = RenderRequestRepository.park({ ref: sketchRef, target: TARGET, kind, manifestHash: manifestHash(sketch.manifest), medium: MEDIUM });
  return {
    ok: true,
    ref: sketchRef,
    kind,
    request_id: request.id,
    status: request.status,
    next: `Mesh request parked (${request.status}). A worker drains it with pull_mesh_render({ ref: '${sketchRef}' }) — or pull_mesh_render({}) to take from the whole mesh queue. `
      + 'No key lives in mojulo: the worker script holds its own (docs/local-mesh-worker.md).',
  };
}

export async function pullMeshRenderHandler(input) {
  const { ref, request_id: requestId } = input || {};
  let request;
  if (requestId) {
    request = RenderRequestRepository.getById(requestId);
    if (!request) throw new Error(`mesh request '${requestId}' not found`);
    if (request.medium !== MEDIUM) throw new Error(`request '${requestId}' is an ${request.medium} request — pull it with pull_${request.medium}_render`);
  } else {
    request = RenderRequestRepository.claimNext({ ref: ref || undefined, medium: MEDIUM });
  }
  if (!request) return { ok: true, request: null, next: 'No pending mesh requests. Nothing to sculpt.' };

  const { sketch, payload, kind } = await resolveMeshSubject(request.ref);
  // The shape prior: the PRINTABLE set (no water / decals / studio grid — the same set the size
  // gate measures) as a GLB at data/outcomes/<ref>/greybox.glb. Overwrite-in-place: it is a
  // regenerated derived snapshot, never a bound artifact.
  const greyPayload = { ...payload, faces: (Array.isArray(payload.faces) ? payload.faces : []).filter(isPrintableFace) };
  const glb = facesToGlb(greyPayload, { generator: `mojulo greybox ${request.ref}` });
  if (!glb) throw new Error(`Sketch '${request.ref}' has no printable geometry to greybox`);
  const dir = outcomeDirFor(request.ref);
  await fs.mkdir(dir, { recursive: true });
  const greyboxPath = path.join(dir, 'greybox.glb');
  await fs.writeFile(greyboxPath, glb.bytes);
  const greybox = { path: greyboxPath, url: `${outcomeUrlFor(request.ref)}greybox.glb`, triangles: glb.triangleCount, vertices: glb.vertexCount };
  const size = greyboxSize(payload);
  const profile = printProfileFor(kind);
  const units = typeof sketch.manifest.units === 'string' ? sketch.manifest.units : null;
  return {
    ok: true,
    request_id: request.id,
    submit_tool: 'submit_mesh_render',
    status: request.status,
    ref: request.ref,
    kind,
    title: sketch.title || sketch.manifest.title || request.ref,
    greybox: { path: greybox.path, url: greybox.url, triangles: greybox.triangles, vertices: greybox.vertices },
    size_world_units: size ? size.size.map((v) => Math.round(v * 1000) / 1000) : null,
    greybox_box: size ? { min: size.min.map((v) => Math.round(v * 1000) / 1000), max: size.max.map((v) => Math.round(v * 1000) / 1000) } : null,
    units,
    print_profile: profile,
    reference_urls: {
      still: `/api/sketches/${encodeURIComponent(request.ref)}/png`,
      turntable: `/api/sketches/${encodeURIComponent(request.ref)}/turntable.png`,
      world: `/api/sketches/${encodeURIComponent(request.ref)}/world`,
    },
    budget: { triangles_max: 200000 },
    workerProtocol: 'image-or-text-to-mesh; the greybox is the SHAPE PRIOR (conditioning input), never the deliverable',
    instructions:
      'Generate a refined mesh of this object conditioned on the greybox GLB and the still/turntable renders: keep the silhouette, proportions, and z-up frame; '
      + `deliver ONE .glb in the same world units (bounding box ≈ ${size ? size.size.map((v) => Math.round(v * 100) / 100).join(' × ') : '?'}${units ? ` ${units}` : ' world units'}, centred where the greybox sits), `
      + 'uncompressed (no Draco/meshopt), triangles only, vertex colours or a baseColor texture. '
      + 'Image-to-mesh generators normalise to their own unit box in their own frame (TripoSR: z-up in the file, ~1 unit tall): re-frame the return onto `greybox_box` before submitting — z-up, base at min z, XY centred — `node scripts/fit-mesh-to-greybox.mjs --ref <ref> --in raw.glb --out fitted.glb [--up triposr]` does exactly that. Then hand it back with '
      + `submit_mesh_render({ request_id: '${request.id}', glb_path, worker_audit: { invoked_generator: true, generator: '<name>', conditioned: 'greybox+images' | 'greybox' | 'prompt-only' }, source: '<worker id>' }).`,
    next: `Sculpt, then submit_mesh_render({ request_id: '${request.id}', glb_path, worker_audit, source }).`,
  };
}

export async function submitMeshRenderHandler(input) {
  const { request_id: requestId, glb_path: glbPath, glb_base64: glbBase64, worker_audit: workerAudit, source, note } = input || {};
  if (!requestId) throw new Error('submit_mesh_render requires { request_id }');
  const request = RenderRequestRepository.getById(requestId);
  if (!request) throw new Error(`mesh request '${requestId}' not found`);
  if (request.medium !== MEDIUM) throw new Error(`request '${requestId}' is an ${request.medium} request`);
  if ((glbPath ? 1 : 0) + (glbBase64 ? 1 : 0) !== 1) throw new Error('submit_mesh_render requires exactly one of glb_path | glb_base64');
  if (!['in_flight', 'submitted', 'rejected'].includes(request.status)) {
    throw new Error(`mesh request '${requestId}' is '${request.status}' — pull it first (submit accepts in_flight | submitted | rejected)`);
  }
  const bytes = glbPath ? await fs.readFile(glbPath) : Buffer.from(glbBase64, 'base64');
  const sketch = SketchRepository.getByRef(request.ref);
  if (!sketch) throw new Error(`Sketch '${request.ref}' not found`);

  // MACHINE GATE 1 — the container + a full decode (glbToFaces throws on bad magic, compressed
  // or empty geometry). Runs BEFORE anything lands on disk.
  const faces = glbToFaces(bytes);
  if (!faces.length) throw new Error('the submitted GLB carries no triangle geometry — submit the sculpted mesh, not an empty scene');

  // MACHINE GATE 2 — size agreement with the greybox: the returned box must sit within 0.5×–2×
  // of the declared extent per axis (a unit slip, a re-centred or mirrored return shows here).
  const { payload } = await resolveWorldScene(sketch);
  const expected = payload ? greyboxSize(payload) : null;
  const got = boundsOfFaces(faces);
  let sizeAgrees = null;
  if (expected) {
    sizeAgrees = [0, 1, 2].every((k) => {
      const e = expected.size[k], g = got.size[k];
      if (e < 1e-6) return true; // a flat axis on the greybox is unconstrained
      return g >= e * 0.5 && g <= e * 2;
    });
  }
  // MACHINE GATE 3 — closure (advisory, travels with the audit).
  const closure = auditClosure(faces);
  const machine = {
    triangles: faces.length,
    size_world_units: got.size.map((v) => Math.round(v * 1000) / 1000),
    expected_size: expected ? expected.size.map((v) => Math.round(v * 1000) / 1000) : null,
    size_agrees: sizeAgrees,
    closure: { closed: closure.holes.length === 0, holes: closure.holes.length, boundary_edges: closure.boundaryEdgeCount },
  };

  const bound = await bindMeshBytes(sketch, bytes, {
    sourcePath: glbPath || null,
    source: typeof source === 'string' && source ? source : null,
    note: note || `mesh handoff submit for request ${requestId}`,
  });
  // seam 6b + the Blender pack's return contract ride the audit too (advisory rows)
  machine.textures = bound.ledger.textures_carried.map((t) => t.key);
  if (bound.contract) machine.contract = bound.contract;
  const updated = RenderRequestRepository.recordSubmit({
    id: requestId,
    renderN: bound.slot.n,
    workerAudit: { ...(workerAudit || {}), machine },
    source: source || null,
  });
  const sizeLine = sizeAgrees === false
    ? ` SIZE GATE FAILED: returned ${machine.size_world_units.join(' × ')} vs greybox ${machine.expected_size.join(' × ')} — re-scale / re-centre and re-submit before accepting.`
    : '';
  return {
    ok: true,
    request_id: updated.id,
    ref: updated.ref,
    n: bound.slot.n,
    path: bound.slot.path,
    bytes: bytes.length,
    sha256: bound.sha256,
    status: updated.status,
    machine,
    next: `Submitted as append-only mesh slot ${bound.slot.n}.${sizeLine} The mesh is NOT accepted until a separate pair of eyes verifies it — `
      + `accept_mesh_render({ request_id: '${updated.id}', accept_audit: { read: '<what you saw>' }, source }) or reject_mesh_render({ request_id: '${updated.id}', accept_audit }). `
      + 'The same worker should not self-accept.',
  };
}

async function resolveGate(input, accept) {
  const { request_id: requestId, accept_audit: acceptAudit, source } = input || {};
  if (!requestId) throw new Error(`${accept ? 'accept' : 'reject'}_mesh_render requires { request_id }`);
  const request = RenderRequestRepository.getById(requestId);
  if (!request) throw new Error(`mesh request '${requestId}' not found`);
  if (request.medium !== MEDIUM) throw new Error(`request '${requestId}' is an ${request.medium} request`);
  if (accept) {
    const acceptor = source ? String(source).trim() : '';
    if (request.source && acceptor && acceptor === request.source) {
      throw new Error(`refusing self-accept: '${acceptor}' both submitted and is accepting request '${requestId}'. A different pair of eyes must run the accept pass.`);
    }
    if (request.workerAudit?.machine?.size_agrees === false && !acceptAudit?.override_size) {
      throw new Error('refusing to accept: the submit failed the size gate. Re-submit a correctly scaled mesh, or pass accept_audit.override_size: "<why the size is right>" to accept anyway.');
    }
  }
  const updated = accept
    ? RenderRequestRepository.recordAccept({ id: requestId, acceptAudit: acceptAudit ? { ...acceptAudit, ...(source ? { acceptedBy: String(source) } : {}) } : null })
    : RenderRequestRepository.recordReject({ id: requestId, acceptAudit: acceptAudit || null });
  const latest = latestBoundMesh(updated.ref);
  return {
    ok: true,
    request_id: updated.id,
    ref: updated.ref,
    status: updated.status,
    ...(accept
      ? {
        mesh: latest ? { n: latest.n, path: latest.path } : null,
        next: `Accepted. The bound mesh is the latest slot for '${updated.ref}': place it in any world via figures: { <name>: { meshRef: '${updated.ref}' } } (lowered server-side to the face list, so /world, stills, and every export render it), `
          + 'or export it onward with export_model.',
      }
      : { next: `Rejected. The worker re-sculpts and re-submits against the same request: submit_mesh_render({ request_id: '${updated.id}', glb_path, worker_audit, source }).` }),
  };
}

export const acceptMeshRenderHandler = (input) => resolveGate(input, true);
export const rejectMeshRenderHandler = (input) => resolveGate(input, false);

export function registerMeshHandoffTools() {
  registerTool({
    name: 'request_mesh_render',
    description:
      'Park a DURABLE mesh request for an object / figure / world sketch — the start of the mesh handoff bicycle (request → pull → submit → accept / reject) that hands the greybox to an external image-to-mesh worker (Meshy / Tripo / Hunyuan3D…). Idempotent per (ref, head manifest). Survives a restart.',
    inputSchema: { type: 'object', properties: { ref: { type: 'string', description: 'The sketch ref (`sk_…`) to sculpt — any kind export_model can greybox.' } }, required: ['ref'] },
    handler: requestMeshRenderHandler,
  });
  registerTool({
    name: 'pull_mesh_render',
    description:
      'Worker-mode claim: take the oldest pending MESH request (marks it in_flight) and get the packet — the greybox GLB path/URL (the shape prior), still + turntable URLs, declared size, triangle budget, instructions, and the submit tool. Pass `ref` to drain one sketch; `{}` drains the queue.',
    inputSchema: { type: 'object', properties: { ref: { type: 'string' }, request_id: { type: 'string', description: 'Re-pull a specific request (e.g. after a reject).' } } },
    handler: pullMeshRenderHandler,
  });
  registerTool({
    name: 'submit_mesh_render',
    description:
      'Hand a worker-generated .glb back for a pulled `request_id`: GLB-validated + decoded at the door, size-checked against the greybox (0.5×–2× per axis), closure-audited, then stored as an append-only mesh slot with a provenance sidecar; moves the request to `submitted`. Does NOT accept — a separate gate does.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string' },
        glb_path: { type: 'string', description: 'Absolute path to the generated .glb on this host (or pass glb_base64).' },
        glb_base64: { type: 'string' },
        worker_audit: { type: 'object', description: "The worker's honest attestation: { invoked_generator, generator, conditioned: 'greybox+images' | 'greybox' | 'prompt-only', notes }." },
        source: { type: 'string', description: 'Worker identity (e.g. meshy, tripo, hunyuan3d, blender) — the accept pass must be a different source.' },
        note: { type: 'string' },
      },
      required: ['request_id'],
    },
    handler: submitMeshRenderHandler,
  });
  registerTool({
    name: 'accept_mesh_render',
    description: 'The eyes gate: accept a submitted mesh after looking at it (silhouette, proportions, no artefacts). Refuses a self-accept and a failed size gate (override with accept_audit.override_size). Accepted meshes are the latest `meshRef` slot.',
    inputSchema: { type: 'object', properties: { request_id: { type: 'string' }, accept_audit: { type: 'object' }, source: { type: 'string', description: "The accepting agent's identity." } }, required: ['request_id'] },
    handler: acceptMeshRenderHandler,
  });
  registerTool({
    name: 'reject_mesh_render',
    description: "The gate's other verdict: reject a submitted mesh with the reason so the worker re-sculpts and re-submits against the same request.",
    inputSchema: { type: 'object', properties: { request_id: { type: 'string' }, accept_audit: { type: 'object' } }, required: ['request_id'] },
    handler: rejectMeshRenderHandler,
  });
}
