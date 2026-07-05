/**
 * create_cascade_view — mint a NUCLEAR CHAIN REACTION: a branching cascade of neutrons fissioning a
 * lattice of nuclei, each fission spawning fragments + fresh neutrons. The mesh-based companion to
 * create_fission_view (which ray-marches the single liquid-drop split) — discrete countable bodies on
 * trajectories, played back on a shared clock via the renderer's mover lifetimes.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE; the
 * substrate stores ONLY the recipe (`kind: 'cascade-view'`, no geometry) and regenerates the deterministic
 * (seeded) cascade on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planCascadeScene, CASCADE_REGIME_NAMES } from '@/lib/graph/landscape/cascade-view';

export function mintCascadeView({ title, regime, nuclei, nu, seed, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'cascade-view',
    regime: CASCADE_REGIME_NAMES.includes(regime) ? regime : 'supercritical',
    ...(Number.isFinite(+nuclei) ? { nuclei: +nuclei } : {}),
    ...(Number.isFinite(+nu) ? { nu: +nu } : {}),
    ...(Number.isFinite(+seed) ? { seed: +seed } : {}),
    ...(Number.isFinite(+scale) ? { scale: +scale } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planCascadeScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.regime} chain reaction`,
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
    stats: plan.stats,
  };
}

export async function createCascadeViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_cascade_view requires a recipe object');
  }
  const { title, regime, nuclei, nu, seed, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintCascadeView({ title, regime, nuclei, nu, seed, scale, viewBox, scene, ref, folderRef });
}
