/**
 * create_cellular_view — mint a 3D CELL: organelles suspended in superposition inside a
 * translucent "jelly" cytoplasm, rendered in the traversable three.js World.
 *
 * Same fractal-generation philosophy as create_planetary / create_molecule_view: the operator
 * passes a tiny RECIPE (a cell type + seed); the substrate stores ONLY that recipe as a sketch
 * manifest (`kind: 'cellular-view'`, no geometry) and regenerates the cell on render. The
 * organelle shapes are OUTPUT through the workbench monomer machinery; each organelle type is a
 * lightly-translucent, CLICKABLE sub-mesh (→ metadata popup) and the cytoplasm is a translucent
 * jelly you see through.
 *
 * Orbit-only object study (like the workbench / molecule-view) — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planCellularScene } from '@/lib/graph/views/bio/cellular-view';

const CELL_TYPES = ['animal', 'plant'];

export function mintCellularView({ title, cellType, seed, scale, jellyAlpha, organelleAlpha, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'cellular-view',
    cellType: CELL_TYPES.includes(cellType) ? cellType : 'animal',
    ...(Number.isFinite(+seed) ? { seed: +seed >>> 0 } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(Number.isFinite(+jellyAlpha) ? { jellyAlpha: +jellyAlpha } : {}),
    ...(Number.isFinite(+organelleAlpha) ? { organelleAlpha: +organelleAlpha } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate the recipe is renderable + return an organelle readout (no geometry
  // is persisted — only the recipe above is stored).
  const plan = planCellularScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.cellType} cell`,
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
    stats: { cellType: plan.stats.cellType, organelles: plan.stats.organelles, faces: plan.faces.length, picks: plan.picks.length },
  };
}

export async function createCellularViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_cellular_view requires a recipe object');
  }
  const { title, cell_type: cellType, seed, scale, jelly_alpha: jellyAlpha, organelle_alpha: organelleAlpha, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintCellularView({ title, cellType, seed, scale, jellyAlpha, organelleAlpha, viewBox, scene, ref, folderRef });
}

export function registerCellularViewTools() {
  registerTool({
    name: 'create_cellular_view',
    description:
      "Mint an interactive 3D CELL — a science/education viewer for cell structure. Two cell types: "
      + "'animal' (nucleus, mitochondria, ER, Golgi, lysosomes, ribosomes) and 'plant' (a boxy cellulose "
      + "cell WALL, a LARGE central VACUOLE that pushes a thin peripheral cytoplasm, green CHLOROPLASTS, "
      + "nucleus, mitochondria, ER, Golgi, ribosomes). Organelles are suspended in "
      + "SUPERPOSITION inside a translucent 'jelly' cytoplasm: the cytoplasm is see-through and each "
      + "organelle is lightly translucent, so overlapping organelles read as layered. The organelle "
      + "shapes are OUTPUT through the workbench's monomer machinery. Served as a live, traversable "
      + "three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom): CLICK any "
      + "organelle to raise a metadata popup (its role / function / structure). You pass a tiny recipe "
      + "(a CELL TYPE + a seed); the substrate stores ONLY the recipe (`manifest.kind === 'cellular-view'`, "
      + "no geometry) and regenerates the cell on render — same seed → same cell. ORBIT-ONLY object study: "
      + "no CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me an animal "
      + "cell in 3D / visualize cell organelles / a cell with its parts I can click'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        cell_type: { type: 'string', enum: [...CELL_TYPES], description: "The cell type to populate (default 'animal'). 'animal' — nucleus, mitochondria, ER, Golgi, lysosomes, ribosomes. 'plant' — boxy cell wall, large central vacuole, chloroplasts, nucleus, mitochondria, ER, Golgi, ribosomes." },
        seed: { type: 'number', description: 'Layout seed — same seed reproduces the same organelle arrangement (default 1).' },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        jelly_alpha: { type: 'number', description: 'Cytoplasm (jelly) opacity 0..1 (default 0.22 — quite see-through).' },
        organelle_alpha: { type: 'number', description: 'Organelle opacity 0..1 (default 0.7 — lightly translucent so overlaps read as superposed).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createCellularViewHandler,
  });
}
