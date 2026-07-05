/**
 * create_parallel_transport_view — mint an interactive HOLONOMY demonstrator in the traversable
 * three.js World: a tangent arrow parallel-transported around a closed loop on a surface, returning
 * ROTATED by the curvature it enclosed (Gauss–Bonnet). The geometric idea behind the Foucault
 * pendulum, the quantum Berry phase, and spacetime curvature — one mechanism, four framings.
 *
 * Same recipe philosophy as the other science views: the operator passes a tiny RECIPE (a scenario);
 * the substrate stores ONLY the recipe (`kind: 'parallel-transport-view'`, no geometry) and recomputes
 * the transport on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planParallelTransportScene, PARALLEL_TRANSPORT_SCENARIOS } from '@/lib/graph/views/science/parallel-transport-view';

export function mintParallelTransportView({ title, scenario, latitude, loopSize, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'parallel-transport-view',
    scenario: PARALLEL_TRANSPORT_SCENARIOS.includes(scenario) ? scenario : 'sphere-triangle',
    ...(Number.isFinite(+latitude) ? { latitude: +latitude } : {}),
    ...(Number.isFinite(+loopSize) ? { loopSize: +loopSize } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.3, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planParallelTransportScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} parallel transport`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: { scenario: plan.stats.scenario, holonomyDeg: plan.stats.holonomyDeg, solidAngleSr: plan.stats.solidAngleSr },
  };
}

export async function createParallelTransportViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_parallel_transport_view requires a recipe object');
  }
  const { title, scenario, latitude, loopSize, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintParallelTransportView({ title, scenario, latitude, loopSize, scale, viewBox, scene, ref, folderRef });
}
