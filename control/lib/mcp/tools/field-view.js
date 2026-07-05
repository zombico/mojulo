/**
 * create_field_view — mint an electromagnetism depictor: a travelling electromagnetic wave, or
 * magnetic field structure (bar magnet / current-carrying wire / solenoid), in the traversable
 * three.js World.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a scenario); the substrate stores ONLY that recipe (`kind: 'field-view'`, no geometry) and
 * regenerates the field on render. The field rides emitThreeWorld's field channel (a lattice of
 * vector arrows + field-line curves). Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planFieldScene, FIELD_SCENARIOS } from '@/lib/graph/views/science/field-view';

export function mintFieldView({ title, scenario, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'field-view',
    scenario: FIELD_SCENARIOS.includes(scenario) ? scenario : 'em-wave',
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFieldScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — field`,
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
    stats: { scenario: plan.stats.scenario, animate: plan.stats.animate, faces: plan.faces.length },
  };
}

export async function createFieldViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_field_view requires a recipe object');
  }
  const { title, scenario, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFieldView({ title, scenario, scale, viewBox, scene, ref, folderRef });
}
