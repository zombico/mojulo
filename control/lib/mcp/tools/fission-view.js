/**
 * create_fission_view — mint a NUCLEAR FISSION event: a compound nucleus that elongates, necks, and
 * CLEAVES into two fragments along the Bohr–Wheeler fission coordinate, ray-marched as a time-evolving
 * VOLUME (the topology-change sibling of the wavepacket cloud). One blob becoming two is exactly what a
 * mesh can't do; an SDF/metaball density field re-topologizes for free.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'fission-view'`, no geometry) and regenerates the shader on
 * render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planFissionScene } from '@/lib/graph/views/science/fission-view';

export function mintFissionView({ title, asymmetry, density, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'fission-view',
    ...(Number.isFinite(+asymmetry) ? { asymmetry: +asymmetry } : {}),
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFissionScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || 'nuclear fission',
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
    stats: { asymmetry: plan.stats.asymmetry, density: plan.stats.density, render: plan.stats.render },
  };
}

export async function createFissionViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_fission_view requires a recipe object');
  }
  const { title, asymmetry, density, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFissionView({ title, asymmetry, density, viewBox, scene, ref, folderRef });
}
