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
