/**
 * create_edifice — mint a BESPOKE inhabitable building authored as a GRAPH.
 *
 * The building-scale sibling of create_workbench: where the workbench bonds object
 * monomers, an edifice composes MASSES (footprint + floors + facade + roof + interior)
 * connected by CONCOURSES (halls), placed by RELATION (mass B sits east of mass A). It
 * is the "workbench for buildings" — the metaprinciple (recipe → plan → baked faces)
 * applied to buildings the frozen generators (fractal-city/school/hub) don't produce.
 *
 * Fractal-generation path: the manifest stores ONLY the recipe (no geometry); the
 * building is regenerated deterministically on render and served walkable at
 * /api/sketches/<ref>/world + .glb, kind === 'edifice'. Design + doctrine:
 * control/lib/graph/architecture/dream-architecture.plan.md.
 *
 * ADVISORY, NEVER GATED: the livability/reachability checks are SURFACED in the mint
 * response, but the building is minted regardless — a user's building is theirs
 * (docs/responsibility-model.md).
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planEdifice, assessEdifice } from '@/lib/graph/architecture/edifice';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

export function mintEdifice({ title, masses, concourses, entrance, seed, theme, viewBox, ref, folderRef } = {}) {
  if (!Array.isArray(masses) || masses.length === 0) {
    throw new Error('mint_solid kind "edifice" requires a non-empty `masses` array (each with a footprint, floors, facade, and an `at` or `on` placement).');
  }
  const manifest = {
    kind: 'edifice',
    masses,
    ...(Array.isArray(concourses) && concourses.length ? { concourses } : {}),
    ...(entrance ? { entrance } : {}),
    ...(seed != null ? { seed } : {}),
    ...(theme ? { theme } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(title ? { title } : {}),
  };

  // Validate the recipe by PLANNING it (bad placement / a concourse between non-facing
  // masses throws here, at mint, not at render) + derive a readout.
  const plan = planEdifice(manifest);
  const assessment = assessEdifice(plan);
  const stats = {
    masses: plan.masses.length,
    concourses: plan.concourses.length,
    maxFloors: Math.max(...plan.masses.map((m) => m.floors)),
    footprintFt: { w: +(plan.bounds.x1 - plan.bounds.x0).toFixed(1), d: +(plan.bounds.y1 - plan.bounds.y0).toFixed(1) },
  };

  const sketch = SketchRepository.create({
      title: title || `edifice · ${stats.masses} mass${stats.masses === 1 ? '' : 'es'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });

  warmScenePng(sketch);

  // Advisory: surface any defects across every check, but the building is minted
  // regardless (never gated — a user's building is theirs).
  const defects = Object.values(assessment).flatMap((c) => c.necessary);
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
    advisory: assessment,
    ...(defects.length ? { note: `Advisory (not enforced): ${defects.map((d) => d.note).join('; ')}. Minted anyway — the building is yours.` } : {}),
  };
}

export async function createEdificeHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_solid kind "edifice" requires a spec with a `masses` array.');
  }
  const { title, masses, concourses, entrance, seed, theme, viewBox, ref, folder_ref: folderRef } = input;
  return mintEdifice({ title, masses, concourses, entrance, seed, theme, viewBox, ref, folderRef });
}
