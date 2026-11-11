/**
 * create_energy_cycle — mint the PHOTOSYNTHESIS ⇄ RESPIRATION energy loop as a traversable World.
 *
 * Recipe-only (like create_molecule_view / create_dna_view): the manifest stores a tiny recipe
 * (`kind: 'energy-cycle'`), the geometry + timed reaction cascade are regenerated on render and
 * served as a live three.js World at `/api/sketches/<ref>/world`. A chloroplast and a mitochondrion
 * trade molecules on a shared clock — products appear only after the reaction that makes them runs,
 * then are consumed or (ATP) stay. Orbit-only science viewer; click an organelle/molecule for info.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planEnergyCycle } from '@/lib/graph/views/bio/energy-cycle';

export function mintEnergyCycle({ title, speed, scene, viewBox, ref, folderRef } = {}) {
  const manifest = {
    kind: 'energy-cycle',
    ...(Number.isFinite(+speed) ? { speed: Math.min(4, Math.max(0.25, +speed)) } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };
  const plan = planEnergyCycle(manifest);   // validate + count

  const sketch = SketchRepository.create({ title: title || 'energy cycle · photosynthesis ⇄ respiration', manifest, ref, folderRef: folderRef ?? null });
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: { faces: plan.faces.length, movers: plan.movers.length, picks: plan.picks.length },
  };
}

export async function createEnergyCycleHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_exhibit({ id: "life/energy-cycle" }) requires a recipe object');
  const { title, speed, scene, viewBox, ref, folder_ref: folderRef } = input;
  return mintEnergyCycle({ title, speed, scene, viewBox, ref, folderRef });
}
