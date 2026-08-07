/**
 * create_molecule_view — mint an interactive ball-and-stick MOLECULE in a traversable World.
 *
 * Same fractal-generation philosophy as create_planetary / create_fractal_city: the operator
 * passes a tiny RECIPE (atoms + bonds + a few knobs); the substrate stores ONLY that recipe as a
 * sketch manifest (`kind: 'molecule-view'`) — no geometry. The atom spheres + blobpla bond rods
 * are regenerated on demand and served as a live three.js World at `/api/sketches/<ref>/world`,
 * where each atom/bond is CLICKABLE → a metadata popup.
 *
 * Orbit-only object study (like planetary) — there is no CSS-3D `/scene` form (interpenetrating
 * ball-and-stick geometry needs per-frame depth-sorting the preserve-3d compositor can't give),
 * so this returns a `worldUrl`, not a `sceneUrl`. Atoms are canonically framed on the molecule's
 * principal axis (PCA → +Z); `chirality` fixes the mirror flip.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planMoleculeScene, BOND_STYLES } from '@/lib/graph/views/bio/molecule-view';
import { MOLECULE_NAMES } from '@/lib/graph/views/bio/molecule-builder';

const LODS = ['draft', 'default', 'hero'];

export function mintMoleculeView({ title, library, atoms, bonds, bondStyle, orient, chirality, axis, mandala, lod, ballScale, bondRadius, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'molecule-view',
    // three author modes (resolved by molecule-builder on render): library name, connectivity-only
    // atoms (symbols/objects without pos → VSEPR), or atoms with explicit coordinates.
    ...(library ? { library } : { atoms: Array.isArray(atoms) ? atoms : [] }),
    ...(Array.isArray(bonds) && bonds.length ? { bonds } : {}),
    ...(BOND_STYLES.includes(bondStyle) ? { bondStyle } : {}),
    ...(orient === false ? { orient: false } : {}),
    ...(+chirality < 0 ? { chirality: -1 } : {}),
    ...(axis === true ? { axis: true } : {}),
    ...(mandala === true ? { mandala: true } : {}),
    ...(LODS.includes(lod) ? { lod } : {}),
    ...(Number.isFinite(+ballScale) ? { ballScale: Math.max(0.1, +ballScale) } : {}),
    ...(Number.isFinite(+bondRadius) ? { bondRadius: Math.max(0.01, +bondRadius) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate the recipe is renderable + return a count readout (no geometry is
  // persisted — only the recipe above is stored). Throws on bad atoms/bonds → surfaced to caller.
  const plan = planMoleculeScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `molecule · ${plan.atoms.length} atoms`,
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
    stats: { atoms: plan.atoms.length, bonds: plan.bonds.length, faces: plan.faces.length, picks: plan.picks.length },
  };
}

export async function createMoleculeViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_molecule_view requires a recipe object');
  }
  const { title, library, atoms, bonds, bond_style: bondStyle, orient, chirality, axis, mandala, lod, ball_scale: ballScale, bond_radius: bondRadius, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintMoleculeView({ title, library, atoms, bonds, bondStyle, orient, chirality, axis, mandala, lod, ballScale, bondRadius, viewBox, scene, ref, folderRef });
}
