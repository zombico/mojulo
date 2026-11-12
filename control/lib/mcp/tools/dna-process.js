/**
 * create_dna_process — mint an animated DNA-biology explainer as a traversable World, selected by
 * `process`: meiosis | conception | recombination | assortment.
 *
 * Recipe-only (like create_dna_view / create_molecule_view): the manifest stores `kind: 'dna-process'`
 * plus the chosen `process`; the geometry (taiji → lit-solid helices) and the animated mover sequence
 * are regenerated on render and served as a live three.js World at `/api/sketches/<ref>/world`.
 * Orbit-only science viewer; click a chromosome for a popup.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planDnaProcess, DNA_PROCESSES } from '@/lib/graph/views/bio/dna-process';

const TITLE = {
  meiosis: 'meiosis · crossover + assortment → a gamete',
  conception: 'fertilization · two gametes combine',
  recombination: 'recombination · crossing-over',
  assortment: 'independent assortment',
};

export function mintDnaProcess({ title, process, scene, viewBox, ref, folderRef } = {}) {
  const proc = DNA_PROCESSES.includes(process) ? process : 'meiosis';
  const manifest = {
    kind: 'dna-process',
    process: proc,
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };
  const plan = planDnaProcess(manifest);   // validate + count

  const sketch = SketchRepository.create({ title: title || `DNA · ${TITLE[proc]}`, manifest, ref, folderRef: folderRef ?? null });
  return {
    ok: true,
    ref: sketch.ref,
    process: proc,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: { faces: plan.faces.length, movers: plan.movers.length, picks: plan.picks.length },
  };
}

export async function createDnaProcessHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('create_exhibit({ id: "life/dna-process" }) requires a recipe object');
  const { title, process, scene, viewBox, ref, folder_ref: folderRef } = input;
  return mintDnaProcess({ title, process, scene, viewBox, ref, folderRef });
}
