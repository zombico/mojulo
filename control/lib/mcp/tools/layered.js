/**
 * mint_solid kind 'layered' — a solid born layered (stations × slots, pinned details, dials).
 *
 * The stored manifest is `{ kind:'layered', title, recipe, dials, channels?, units, facing, seat?, toon?,
 * ledger }`: the RECIPE is the source; on every read the world registry lowers it through
 * station-loft-faces.js to studio faces (the compiled mesh itself), so a dial patch (`update_sketch { patch:[{ op:'set',
 * path:'/dials/jawOpen', value: 30 }] }`) reshapes the solid in place and the studio, `measure_solid`
 * and every export leg see the recompiled mesh. The mint pays the layered audit (per-part closure) and,
 * for a rigged recipe, the rig gates.
 * Manual: lib/graph/solid-vocab/layered.md. Reference recipe: docs/examples/dragon-layered.
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveToon } from '@/lib/graph/polygonizer/vexar';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';
import { compileLayered, resolveLayeredDials } from '@/lib/graph/polygonizer/station-loft';
import { layeredStats, persistedLayeredLedger } from '@/lib/graph/polygonizer/station-loft-faces';
import { validateRig, bindLayered, auditRig, layeredClip } from '@/lib/graph/polygonizer/station-loft-rig';

/** Compile + audit + lower + the workbench plan gate, for the mint and the readouts. Throws with a pointer. */
export function planLayered(manifest) {
  let mesh;
  try { mesh = compileLayered(manifest.recipe, manifest.dials || {}, manifest.channels || {}); }
  catch (err) { throw new Error(`layered recipe: ${err.message} — manual: get_solid_vocab({ id: 'layered' }).`); }
  const stats = layeredStats(mesh, manifest.recipe, { units: manifest.units || 'm', seat: manifest.seat !== false });
  // a rigged recipe pays its gates at mint: bindings by declaration, rest skinning identity, every clip's keyposes solvable
  let rig = null;
  if (manifest.recipe.rig) {
    try {
      const R = validateRig(manifest.recipe.rig); const skin = bindLayered(mesh, manifest.recipe, R);
      const clips = manifest.recipe.clips || {}; for (const [name, keys] of Object.entries(clips)) layeredClip(keys, R);
      const a = auditRig(mesh, skin, R, Object.values(clips).flat());
      if (a.badWeights || a.restIdentity > 1e-9 || a.maxPlantedDrift > 1e-9) throw new Error(`bad weights ${a.badWeights}, rest identity ${a.restIdentity}, planted drift ${a.maxPlantedDrift}`);
      rig = { bones: R.bones.length, blendedVertices: a.blended, clips: Object.keys(clips), maxLengthError: a.maxLengthError, legs: a.poses.map((p) => p.legs) };
    } catch (err) { throw new Error(`layered rig: ${err.message} — manual: get_solid_vocab({ id: 'layered' }).`); }
  }
  return { mesh, stats: { ...stats, layered: { dials: mesh.dials, parts: Object.keys(mesh.parts).length, auditFailures: stats.auditFailures, ...(rig ? { rig } : {}) } } };
}

export async function createLayeredHandler(input) {
  if (!input || typeof input !== 'object' || !input.recipe || typeof input.recipe !== 'object' || !input.recipe.parts) {
    throw new Error("The layered kind needs `recipe` — { frame, parts: { <name>: { layer, slots, stations, caps | pin, offsets, faces } }, dials?, creases? }. Read get_solid_vocab({ id: 'layered' }); the worked recipe is docs/examples/dragon-layered/recipe.json.");
  }
  const { title, recipe, dials, channels, units, facing, seat, toon, ref, folder_ref: folderRef } = input;
  const manifest = {
    kind: 'layered',
    ...(title ? { title } : {}),
    recipe,
    dials: resolveLayeredDials(recipe.dials || {}, dials || {}),   // every dial stored at its value, so a patch by path finds it
    ...(channels && typeof channels === 'object' ? { channels } : {}),
    units: typeof units === 'string' ? units : 'm',   // stored, not defaulted at read: measure_solid and the STL scale read the manifest's units
    ...(typeof facing === 'string' || Number.isFinite(facing) ? { facing } : {}),
    ...(seat === false ? { seat: false } : {}),
    ...(toon != null ? { toon: resolveToon(toon) ? toon : undefined } : {}),
  };
  const { stats } = planLayered(manifest);
  manifest.ledger = persistedLayeredLedger(stats.ledger);
  const sketch = SketchRepository.create({ title: title || `layered · ${stats.monomers} part${stats.monomers === 1 ? '' : 's'}`, manifest, ref, folderRef: folderRef ?? null });
  warmScenePng(sketch);
  return {
    ok: true, ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`, sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`, url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
    next: { tool: 'update_sketch', args: { ref: sketch.ref, patch: [{ op: 'set', path: '/dials/<name>', value: '<number>' }] }, reason: 'Turn a dial in place; the solid re-lowers on read.' },
  };
}
