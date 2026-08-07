/**
 * create_field_flow_view — mint a VECTOR FIELD on the plane: an arrow at every point showing which way a
 * particle is pushed, with streamlines and drifting tracer beads. Every scenario is a LINEAR field F = A·x,
 * so its phase-portrait type is decided by the EIGENVALUES of A (divergence = trace, curl = A21 − A12).
 * source/sink/vortex/saddle/spiral. The visual core of vector calculus & differential equations. Part of
 * mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario OR an
 * explicit matrix); the substrate stores ONLY the recipe (`kind: 'field-flow-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planFieldFlowScene, FIELD_FLOW_SCENARIOS } from '@/lib/graph/views/science/field-flow-view';

export function mintFieldFlowView({ title, scenario, matrix, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'field-flow-view',
    scenario: FIELD_FLOW_SCENARIOS.includes(scenario) ? scenario : 'spiral',
    ...(Array.isArray(matrix) ? { matrix } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFieldFlowScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Vector field (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: plan.stats,
  };
}

export async function createFieldFlowViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_field_flow_view requires a recipe object');
  const { title, scenario, matrix, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFieldFlowView({ title, scenario, matrix, scale, viewBox, scene, ref, folderRef });
}
