/**
 * create_fusion_view — mint a NUCLEAR FUSION event: deuterium + tritium merging into He-4 plus a fast
 * neutron, ray-marched as a time-evolving VOLUME (the release-mechanism counterpart of create_fission_view,
 * and a topology-change MERGE — the inverse of the fission split).
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'fusion-view'`, no geometry) and regenerates the shader on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planFusionScene } from '@/lib/graph/views/science/fusion-view';

export function mintFusionView({ title, density, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'fusion-view',
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFusionScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || 'nuclear fusion',
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
    stats: { density: plan.stats.density, render: plan.stats.render },
  };
}

export async function createFusionViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_fusion_view requires a recipe object');
  }
  const { title, density, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFusionView({ title, density, viewBox, scene, ref, folderRef });
}
