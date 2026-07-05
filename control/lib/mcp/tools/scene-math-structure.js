/**
 * math-structure world — mint a walkable mathematical structure from a tiny recipe
 * (math-worlds.plan.md, Phase 1). Reached through `compose_world({ base: 'math' })`.
 *
 * Same fractal-generation philosophy as create_fractal_city: the operator passes a recipe (a
 * `structure` descriptor — which group, presented how); the substrate stores ONLY that recipe
 * (`kind: 'math-structure'`) — no geometry. The full walkable Cayley city is regenerated
 * deterministically on render at `/api/sketches/<ref>/world`, where every plaza is a group element
 * and every generator is a distinct street type. Walking a relation returns you to your start plaza:
 * the theorem, felt.
 *
 * Stored manifest: { kind:'math-structure', structure:{ family, n }, title? }
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { assembleMathStructureScene, planMathStructure } from '@/lib/graph/structures/math-structure';
import { assembleKoenigsbergScene, planKoenigsberg, eulerTrailStatus, searchAllTrails, KOENIGSBERG_VARIANTS } from '@/lib/graph/structures/koenigsberg';

const KNOWN_FAMILIES = new Set(['cyclic', 'dihedral', 'symmetric', 'quaternion']);

export function mintMathStructure({ title, structure, seed, ref, folderRef } = {}) {
  const spec = structure && typeof structure === 'object' ? structure : { family: 'dihedral', n: 4 };
  // Königsberg is a playable-theorem structure (Phase 2), not a group city — dispatch to its own kind.
  if (spec.kind === 'koenigsberg' || spec.family === 'koenigsberg') {
    return mintKoenigsberg({ title, structure: spec, ref, folderRef });
  }
  const family = spec.family || 'dihedral';
  if (!KNOWN_FAMILIES.has(family)) {
    throw new Error(`compose_world(base:'math'): unknown structure family '${family}'. Known: ${[...KNOWN_FAMILIES].join(', ')}`);
  }
  const manifest = {
    kind: 'math-structure',
    structure: { family, ...(spec.n != null ? { n: spec.n } : {}), ...(spec.innerRadius != null ? { innerRadius: spec.innerRadius } : {}), ...(spec.ringGap != null ? { ringGap: spec.ringGap } : {}) },
    ...(title ? { title } : {}),
  };

  // validate the recipe renders (throws on a malformed family / degenerate closure) — nothing
  // beyond the recipe is persisted.
  assembleMathStructureScene(manifest, { title });
  const built = planMathStructure(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || `${built.group.title} — Cayley city`, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  const enc = encodeURIComponent(sketch.ref);
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${enc}/world`,
    url: `/sketches/${enc}`,
    recipe: manifest,
    stats: {
      group: built.group.title,
      order: built.group.order,
      generators: built.plan.generators.map((g) => g.symbol),
      relations: built.group.relations,
      plazas: built.plan.vertices.length,
      streets: built.plan.edges.length,
      walkable: true,
      nonBakeable: true,
    },
  };
}

function mintKoenigsberg({ title, structure, ref, folderRef }) {
  const variant = KOENIGSBERG_VARIANTS[structure.variant] ? structure.variant : 'historic';
  const manifest = { kind: 'koenigsberg', structure: { kind: 'koenigsberg', variant }, ...(title ? { title } : {}) };
  assembleKoenigsbergScene(manifest, { title });                 // validate it renders
  const built = planKoenigsberg(manifest);
  const status = eulerTrailStatus(built.bridges);
  const search = searchAllTrails(built.bridges);

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || built.title, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  const enc = encodeURIComponent(sketch.ref);
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${enc}/world`,
    url: `/sketches/${enc}`,
    recipe: manifest,
    stats: {
      structure: built.title,
      variant,
      bridges: built.bridges.length,
      oddShores: status.oddCount,
      eulerTrailExists: status.exists,
      reason: status.reason,
      bruteForceCompletes: search.completes,
      maxCrossings: search.maxCrossings,
      certificate: search.certificate,
      walkable: true,
      nonBakeable: true,
    },
  };
}
