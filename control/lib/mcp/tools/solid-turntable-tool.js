/**
 * create_solid_turntable — mint a single convex solid spinning LIVE in dependency-free CSS-3D.
 *
 * Same fractal-generation philosophy as create_fractal_city: the operator passes a tiny RECIPE
 * (a shape + a few knobs); the substrate stores ONLY that recipe as a sketch manifest
 * (`kind: 'css3d-turntable'`) — no geometry. The solid is regenerated and rendered to a
 * self-contained preserve-3d HTML page on demand by `/api/sketches/<ref>/scene`, where it spins
 * with the highlight fixed in the viewport (a real lit object, not a baked clip).
 *
 * Scope is deliberately a SINGLE convex solid — the only class the live CSS backend renders
 * exactly (a convex hull never self-occludes). Interpenetrating ball-and-stick molecules and
 * self-folding chiral helices stay on the baked `forge_motion` turntable.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planSolidTurntable, SOLID_SHAPES, SOLID_SURFACES } from '@/lib/graph/worlds/solid-turntable';
import { CRYSTAL_GEMS, CRYSTAL_CUTS } from '@/lib/graph/polygonizer/crystal-optics';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

export function mintSolidTurntable({ title, shape, color, surface, tilt, spinSeconds, lod, viewBox, gem, cut, size, glow, ref, folderRef } = {}) {
  // a crystal surface is the crystal shape's own, and a gem or cut is one the crystal knows: refused here, not
  // rendered as something else (the plan falls back to vexar / quartz / natural for a recipe stored by hand)
  if (surface === 'crystal' && shape !== 'crystal') {
    throw new Error(`surface 'crystal' is the crystal shape's own: give shape: 'crystal' (with gem and cut), or a surface of ${SOLID_SURFACES.filter((s) => s !== 'crystal').join(', ')} for a ${SOLID_SHAPES.includes(shape) ? shape : 'sphere'}`);
  }
  if (shape === 'crystal' && gem !== undefined && !CRYSTAL_GEMS.includes(gem)) throw new Error(`gem must be one of ${CRYSTAL_GEMS.join(', ')} (got ${JSON.stringify(gem)})`);
  if (shape === 'crystal' && cut !== undefined && !CRYSTAL_CUTS.includes(cut)) throw new Error(`cut must be one of ${CRYSTAL_CUTS.join(', ')} (got ${JSON.stringify(cut)})`);
  const manifest = {
    kind: 'css3d-turntable',
    shape: SOLID_SHAPES.includes(shape) ? shape : 'sphere',
    ...(/^#[0-9a-fA-F]{6}$/.test(color || '') ? { color } : {}),
    ...(SOLID_SURFACES.includes(surface) ? { surface } : {}),
    ...(Number.isFinite(+tilt) ? { tilt: +tilt } : {}),
    ...(Number.isFinite(+spinSeconds) ? { spinSeconds: Math.max(2, +spinSeconds) } : {}),
    ...(lod ? { lod } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
    // shape 'crystal': the gem, its cut, its size in cm (crystal-turntable.js); stored only when given
    ...(shape === 'crystal' && typeof gem === 'string' ? { gem } : {}),
    ...(shape === 'crystal' && typeof cut === 'string' ? { cut } : {}),
    ...(shape === 'crystal' && Number.isFinite(+size) && +size > 0 ? { size: +size } : {}),
    ...(shape === 'crystal' && Number.isFinite(+glow) && +glow > 0 ? { glow: Math.min(1, +glow) } : {}),
  };

  // Resolve once to validate the recipe is renderable + return a face-count readout (no
  // geometry is persisted — only the recipe above is stored).
  const plan = planSolidTurntable(manifest);

  const sketch = SketchRepository.create({
      title: title || `${manifest.shape} turntable`,
      manifest, ref, folderRef: folderRef ?? null,
    });

  warmScenePng(sketch);   // background pre-bake of the gallery preview PNG

  return {
    ok: true,
    ref: sketch.ref,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: { shape: plan.shape, surface: plan.surface, faces: plan.faces.length, ...(plan.crystal ? { gem: plan.crystal.gem, cut: plan.crystal.cut } : {}) },
  };
}

export async function createSolidTurntableHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_solid kind "solid-turntable" requires a spec');
  }
  const { title, shape, color, surface, tilt, spin_seconds: spinSeconds, lod, viewBox, gem, cut, size, glow, ref, folder_ref: folderRef } = input;
  return mintSolidTurntable({ title, shape, color, surface, tilt, spinSeconds, lod, viewBox, gem, cut, size, glow, ref, folderRef });
}
