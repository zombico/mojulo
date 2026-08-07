/**
 * create_conics_view — mint where the CONIC SECTIONS come from: slice a double cone with a plane and the
 * cut is a circle, ellipse, parabola, or hyperbola, decided only by how steeply the plane is tilted vs
 * the cone's half-angle. The translucent cone, the cutting plane, and the bright intersection curve are
 * all orbit-able. Part of mojulo's EDUCATION module (math explainers).
 *
 * Same recipe philosophy as the science views: the operator passes a tiny recipe (a scenario); the
 * substrate stores ONLY the recipe (`kind: 'conics-view'`, no geometry) and regenerates the scene on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planConicsScene, CONICS_SCENARIOS } from '@/lib/graph/views/math/conics-view';

export function mintConicsView({ title, scenario, animate, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'conics-view',
    scenario: CONICS_SCENARIOS.includes(scenario) ? scenario : 'ellipse',
    ...(animate === false ? { animate: false } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planConicsScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Conic sections (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createConicsViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_conics_view requires a recipe object');
  const { title, scenario, animate, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintConicsView({ title, scenario, animate, scale, viewBox, scene, ref, folderRef });
}
