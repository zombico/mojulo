/**
 * create_star_surface_view — mint a star's SURFACE (the photosphere): a self-luminous sphere whose
 * colour is a Planck blackbody map of a live temperature field (granulation + cool spots + limb
 * darkening). The solid-body counterpart to mojulo's raymarched gas stars. sun / red-dwarf / blue-giant
 * / spotted — the star class sets the surface temperature, which the blackbody map turns into the star's
 * TRUE colour. Part of mojulo's science views.
 *
 * Same recipe philosophy as the other views: the operator passes a tiny recipe (a scenario); the
 * substrate stores ONLY the recipe (`kind:'star-surface-view'`, no geometry) and regenerates on render.
 * Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planStarSurfaceScene, STAR_SURFACE_SCENARIOS } from '@/lib/graph/views/science/star-surface-view';

export function mintStarSurfaceView({ title, scenario, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'star-surface-view',
    scenario: STAR_SURFACE_SCENARIOS.includes(scenario) ? scenario : 'sun',
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planStarSurfaceScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `Star surface (${manifest.scenario})`, manifest, ref, folderRef: folderRef ?? null });
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

export async function createStarSurfaceViewHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_star_surface_view requires a recipe object');
  const { title, scenario, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintStarSurfaceView({ title, scenario, scale, viewBox, scene, ref, folderRef });
}
