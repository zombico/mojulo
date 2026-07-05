/**
 * create_transform_view — mint a LINEAR MAP A: ℝ² → ℝ² shown as the deformation of space: a faint
 * reference grid, the bright image grid, the basis vectors î/ĵ, the unit square (→ parallelogram, area =
 * det) and the unit circle (→ the SVD ellipse). Eigenvectors appear as the invariant axes; the view
 * MORPHS identity → A live (the deform channel). Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario OR an
 * explicit matrix); the substrate stores ONLY the recipe (`kind: 'transform-view'`, no geometry) and
 * regenerates the scene on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planTransformScene, TRANSFORM_SCENARIOS } from '@/lib/graph/views/math/transform-view';

export function mintTransformView({ title, scenario, matrix, dim, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'transform-view',
    scenario: TRANSFORM_SCENARIOS.includes(scenario) ? scenario : 'eigenbasis',
    ...(Array.isArray(matrix) ? { matrix } : {}),
    ...(dim === 3 ? { dim: 3 } : {}),
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planTransformScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Linear transform (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createTransformViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_transform_view requires a recipe object');
  const { title, scenario, matrix, dim, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintTransformView({ title, scenario, matrix, dim, animate, scale, viewBox, scene, ref, folderRef });
}
