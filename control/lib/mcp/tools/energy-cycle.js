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
import { registerTool } from '@/lib/mcp/server';
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

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || 'energy cycle · photosynthesis ⇄ respiration', manifest, ref, folderRef: folderRef ?? null });
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
    stats: { faces: plan.faces.length, movers: plan.movers.length, picks: plan.picks.length },
  };
}

export async function createEnergyCycleHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_energy_cycle requires a recipe object');
  const { title, speed, scene, viewBox, ref, folder_ref: folderRef } = input;
  return mintEnergyCycle({ title, speed, scene, viewBox, ref, folderRef });
}

export function registerEnergyCycleTools() {
  registerTool({
    name: 'create_energy_cycle',
    description:
      "Mint an interactive 3D ENERGY CYCLE — the photosynthesis ⇄ respiration loop that links plant and "
      + "animal cells, as a live traversable World at `/api/sketches/<ref>/world` (drag to ORBIT). A CHLOROPLAST "
      + "(green, grana stacks) runs photosynthesis (6 CO₂ + 6 H₂O + light → glucose + 6 O₂); a MITOCHONDRION "
      + "(orange, crista fold) runs respiration (glucose + 6 O₂ → 6 CO₂ + 6 H₂O + ATP). Molecules (CPK ball-and-"
      + "stick) flow along two arcs on a TIMED reaction cascade: a product only appears once the reaction that "
      + "makes it has run, then is consumed by the next organelle (or ATP stays as delivered energy). CLICK an "
      + "organelle or molecule for a popup (reaction, where it's found). Both organelles sit in a plant cell; an "
      + "animal cell has only the mitochondrion — so the loop is plant↔animal. Recipe-only; the substrate stores "
      + "`manifest.kind === 'energy-cycle'` and regenerates the scene. Reach for this on framing like 'show the "
      + "energy cycle / photosynthesis and respiration / how plants and animals exchange CO₂ and O₂'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        speed: { type: 'number', minimum: 0.25, maximum: 4, description: 'Animation speed multiplier on the reaction timeline (default 1; higher = faster cascade).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#070b16" } for the background colour.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1240×720).' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
    },
    handler: createEnergyCycleHandler,
  });
}
