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

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
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
