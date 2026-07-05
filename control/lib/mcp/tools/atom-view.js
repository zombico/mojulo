/**
 * create_atom_view — mint a single ATOM depicted as a nucleus wrapped in electron ORBITALS
 * (standing waves), drawn with the wave primitives: s orbitals as lathe spheres, p orbitals as
 * phase-coloured vajra dumbbells (the waist pinched to the nodal plane at the nucleus). The
 * scientifically-honest alternative to the Bohr "dots on rings" picture.
 *
 * Same fractal-generation philosophy as create_molecule_view: the operator passes a tiny RECIPE
 * (an element); the substrate stores ONLY that recipe (`kind: 'atom-view'`, no geometry) and
 * regenerates the atom on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planAtomScene } from '@/lib/graph/views/science/atom-view';

export function mintAtomView({ title, element, Z, mode, style, orbital, viewBox, scene, ref, folderRef } = {}) {
  const scientific = style === 'scientific';
  const manifest = {
    kind: 'atom-view',
    ...(scientific ? { style: 'scientific' } : {}),
    ...(scientific && orbital ? { orbital: String(orbital) } : {}),
    ...(!scientific && element ? { element: String(element) } : {}),
    ...(!scientific && Number.isFinite(+Z) ? { Z: +Z } : {}),
    ...(!scientific && mode === 'tour' ? { mode: 'tour' } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  // Artistic (mesh) view: resolve once to validate + return the electron-configuration readout. The
  // scientific (volumetric, ray-marched) view is a single orbital — no mesh geometry to validate.
  const plan = scientific ? null : planAtomScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || (scientific ? `hydrogen ${manifest.orbital || '3dz2'} orbital` : `${plan.stats.element} atom`),
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
    stats: scientific
      ? { style: 'scientific', orbital: manifest.orbital || '3dz2', render: 'volumetric |ψ|² (ray-marched)' }
      : { element: plan.stats.element, Z: plan.stats.Z, config: plan.stats.subshells, faces: plan.faces.length, picks: plan.picks.length, ...(plan.stats.dropped.length ? { not_rendered: plan.stats.dropped } : {}) },
  };
}

export async function createAtomViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_atom_view requires a recipe object');
  }
  const { title, element, Z, mode, style, orbital, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintAtomView({ title, element, Z, mode, style, orbital, viewBox, scene, ref, folderRef });
}
