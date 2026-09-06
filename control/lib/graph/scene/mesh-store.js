/**
 * Bound external meshes — the refined .glb files bind_mesh_render snapshots
 * onto a sketch ref (interchange.plan.md I3, the bind-back door). Same posture
 * as image-outcomes/render-store.js and voice/voice-sample-store.js: append-only
 * slots in the ref's outcome folder (`data/outcomes/<ref>/mesh-<n>.glb`), never
 * edited in place, never required — the recipe is complete without a binding.
 * Provenance rides a sidecar (`mesh-<n>.glb.json`) beside each slot; the
 * `meshRef` body source (worlds/world-scene.js) reads the LATEST binding.
 *
 * Timeless module: `n` comes from what's on disk, never from the clock.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function outcomesBaseDir() {
  return process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
}

export function meshDir(ref) {
  return path.join(outcomesBaseDir(), ref);
}

function boundNumbers(ref) {
  const dir = meshDir(ref);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => f.match(/^mesh-(\d+)\.glb$/))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

/** Latest bound mesh for ref — { n, path, sidecarPath } — or null. */
export function latestBoundMesh(ref) {
  const numbers = boundNumbers(ref);
  if (!numbers.length) return null;
  const n = numbers[numbers.length - 1];
  const p = path.join(meshDir(ref), `mesh-${n}.glb`);
  return { n, path: p, sidecarPath: `${p}.json` };
}

/** Reserve the next append-only slot for ref. */
export function nextMeshPath(ref) {
  const numbers = boundNumbers(ref);
  const n = numbers.length ? numbers[numbers.length - 1] + 1 : 1;
  mkdirSync(meshDir(ref), { recursive: true });
  const p = path.join(meshDir(ref), `mesh-${n}.glb`);
  return { n, path: p, sidecarPath: `${p}.json` };
}

/**
 * describeBoundMeshes(ref, { manifestHash }) → [{ n, path, source, bound_at, sha256, bytes,
 *   note, manifest_hash, stale, textures, contract_ok, contract_drift }] — every slot with
 * its sidecar read back, oldest first. `stale` (export-blender.plan.md D7): the recipe has
 * re-minted past the manifest the binding was made against — surfaced, never
 * auto-invalidated (hand work is not regenerable). null when either hash is unknown.
 */
export function describeBoundMeshes(ref, { manifestHash = null } = {}) {
  const dir = meshDir(ref);
  return boundNumbers(ref).map((n) => {
    const p = path.join(dir, `mesh-${n}.glb`);
    let sc = {};
    try { sc = JSON.parse(readFileSync(`${p}.json`, 'utf8')); } catch { sc = {}; }
    const boundHash = typeof sc.manifest_hash === 'string' ? sc.manifest_hash : null;
    return {
      n, path: p,
      source: sc.source ?? null, bound_at: sc.bound_at ?? null, sha256: sc.sha256 ?? null, bytes: sc.bytes ?? null, note: sc.note ?? null,
      manifest_hash: boundHash,
      stale: manifestHash && boundHash ? boundHash !== manifestHash : null,
      textures: Array.isArray(sc.textures) ? sc.textures : [],
      contract_ok: sc.contract && typeof sc.contract.ok === 'boolean' ? sc.contract.ok : null,
      contract_drift: Array.isArray(sc.contract?.contract_drift) ? sc.contract.contract_drift.length : null,
    };
  });
}
