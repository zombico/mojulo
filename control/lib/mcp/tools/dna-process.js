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
import { registerTool } from '@/lib/mcp/server';
import { planDnaProcess, DNA_PROCESSES } from '@/lib/graph/dna-process';

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

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `DNA · ${TITLE[proc]}`, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }
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
  if (!input || typeof input !== 'object') throw new Error('create_dna_process requires a recipe object');
  const { title, process, scene, viewBox, ref, folder_ref: folderRef } = input;
  return mintDnaProcess({ title, process, scene, viewBox, ref, folderRef });
}

export function registerDnaProcessTools() {
  registerTool({
    name: 'create_dna_process',
    description:
      "Mint an ANIMATED DNA-BIOLOGY explainer as a live, traversable World at `/api/sketches/<ref>/world` "
      + "(drag to ORBIT; the animation loops). Pick `process`: 'meiosis' (the whole gamete-making sequence — "
      + "homologous pairs cross over into mosaics, then segregate, keeping one recombined copy of each "
      + "chromosome and discarding the rest), 'conception' (FERTILIZATION — a maternal + paternal helix converge "
      + "into a homologous pair / the diploid zygote), 'recombination' (CROSSING-OVER — a recombined mosaic gamete "
      + "is kept while the remainder is ejected as a polar body), or 'assortment' (INDEPENDENT ASSORTMENT — four "
      + "chromosome pairs each randomly keep one copy for the gamete (up) and discard the other (down)). "
      + "Chromosomes are taiji-lowered lit double helices (maternal = warm, paternal = cool); motion is the world's "
      + "mover channel. CLICK a chromosome for a popup. Recipe-only; the substrate stores `manifest.kind === "
      + "'dna-process'` + `process` and regenerates the scene. For the STATIC double helix use create_dna_view "
      + "instead. Reach for this on framing like 'animate meiosis / show fertilization / how DNA recombines / "
      + "independent assortment'.",
    inputSchema: {
      type: 'object',
      properties: {
        process: { type: 'string', enum: [...DNA_PROCESSES], description: "Which process to animate: 'meiosis' (default), 'conception', 'recombination', or 'assortment'." },
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0a0f1c" }.' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1200×760).' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
    },
    handler: createDnaProcessHandler,
  });
}
