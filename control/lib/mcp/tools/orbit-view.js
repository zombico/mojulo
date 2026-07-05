/**
 * create_orbit_view — mint an orbital-mechanics depictor: bodies moving on real Kepler orbits around
 * a central mass, in the traversable three.js World. The "space frame" sibling of create_mechanics_view
 * and the moving-system counterpart to create_planetary's single static body.
 *
 * Accurate motion, artistic scale (an orrery): distances + body sizes are COMPRESSED so everything
 * reads in one frame, while the MOTION stays exact — Kepler's 2nd law (perihelion speed-up) and 3rd
 * law (real period ratios), with the readout showing REAL distance / speed (vis-viva) / period.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a scenario); the substrate stores ONLY that recipe (`kind: 'orbit-view'`, no geometry) and
 * regenerates the system on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planOrbitScene, ORBIT_SCENARIOS } from '@/lib/graph/views/science/orbit-view';

export function mintOrbitView({ title, scenario, scale, vectors, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'orbit-view',
    scenario: ORBIT_SCENARIOS.includes(scenario) ? scenario : 'system',
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(vectors === false ? { vectors: false } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planOrbitScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — orbit`,
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
    stats: { scenario: plan.stats.scenario, bodies: plan.stats.bodies, faces: plan.faces.length },
  };
}

export async function createOrbitViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_orbit_view requires a recipe object');
  }
  const { title, scenario, scale, vectors, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintOrbitView({ title, scenario, scale, vectors, viewBox, scene, ref, folderRef });
}
