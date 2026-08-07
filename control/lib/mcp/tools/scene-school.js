/**
 * scene-school — mint a SCHOOL COMPLEX from a tiny recipe (the fractal-generation path).
 *
 * A sibling of the fractal-city / transport-hub mints, tuned to an education campus. The caller
 * passes a seed plus a few knobs (pattern / program / facade / floors); the substrate stores ONLY
 * the recipe (`kind: 'school-complex'`) — no geometry — and regenerates the whole campus
 * deterministically on render through the world-kind registry (walkable /world + .glb). This is
 * the `school` base behind `compose_world`; see fractal-school.plan.md.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planFractalSchoolComplex, assembleFractalSchoolScene } from '@/lib/graph/architecture/fractal-school';

/**
 * Mint a school-complex sketch. Validation (unimplemented pattern/program/facade) throws loudly
 * from planFractalSchoolComplex before anything is persisted.
 */
export function mintSchoolComplex({ title, seed, pattern, program, facade, floors, structure, shadows, viewBox, ref, folderRef } = {}) {
  const manifest = {
    kind: 'school-complex',
    ...(Number.isFinite(+seed) ? { seed: +seed >>> 0 } : {}),
    ...(pattern ? { pattern } : {}),
    ...(program ? { program } : {}),
    ...(facade ? { facade } : {}),
    ...(floors !== undefined && floors !== null ? { floors } : {}),
    ...(structure === false ? { structure: false } : {}),
    ...(shadows === false ? { shadows: false } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate the recipe is renderable + return a stats readout (no geometry is
  // persisted — only the recipe above is stored).
  const plan = planFractalSchoolComplex(manifest);
  const scene = assembleFractalSchoolScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${plan.pattern} ${plan.program} · school complex`,
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
    stats: {
      pattern: plan.pattern,
      program: plan.program,
      facade: plan.facade,
      buildings: plan.buildings.length,
      rooms: plan.rooms.length,
      faces: scene.faces.length,
      walkable: scene.walkability.ok,
      principlesScore: scene.principles.score,
    },
  };
}

export async function createSchoolComplexHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_school_complex requires a recipe object');
  }
  return mintSchoolComplex(input);
}
