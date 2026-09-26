/**
 * mint_solid kind 'layered' — a solid born layered (stations × slots, pinned details, dials).
 *
 * The stored manifest is `{ kind:'layered', title, recipe, plan?, dials, channels?, units, facing, seat?,
 * toon?, ledger }`: the RECIPE is the source; on every read the world registry lowers it through
 * station-loft-faces.js to studio faces (the compiled mesh itself), so a dial patch (`update_sketch { patch:[{ op:'set',
 * path:'/dials/jawOpen', value: 30 }] }`) reshapes the solid in place and the studio, `measure_solid`
 * and every export leg see the recompiled mesh. The mint pays the layered audit (per-part closure) and,
 * for a rigged recipe, the rig gates.
 * The PLAN door (`mint_solid { kind:'layered', via:'plan', plan }`): a ring plan (station-loft-plan.js — a joint
 * table, segments with ring radii, details by address, dials / rig / clips as data) is expanded into the recipe
 * at mint and stored beside it; an `update_sketch` patch under `/plan` re-expands the recipe, a patch under
 * `/dials` or `/recipe` edits as before. The recipe stays the compatibility promise; the plan is the authoring record.
 * Manual: lib/graph/solid-vocab/layered.md. Reference recipe: docs/examples/dragon-layered; reference plan:
 * docs/examples/dragon-body/seed-recipe.mjs.
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveToon } from '@/lib/graph/polygonizer/vexar';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';
import { compileLayered, resolveLayeredDials } from '@/lib/graph/polygonizer/station-loft';
import { expandPlan } from '@/lib/graph/polygonizer/station-loft-plan';
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

/** A manifest carrying a `plan` regenerates its recipe from it; dial values for dials the new recipe lacks are dropped. */
export function expandLayeredManifest(manifest) {
  if (!manifest?.plan) return manifest;
  const recipe = expandPlan(manifest.plan);
  const known = new Set(Object.keys(recipe.dials || {}));
  const dials = Object.fromEntries(Object.entries(manifest.dials || {}).filter(([k]) => known.has(k)));
  return { ...manifest, recipe, dials: resolveLayeredDials(recipe.dials || {}, dials) };
}

/** The plan audit — WHO printed the numbers. Mojulo is loopback and cannot watch a worker, so this is form + presence
 * (the dream-audit posture): `source` 'agent' (the agent wrote the numbers itself), 'text:<model>' or 'image:<worker>'
 * (a worker did; then `prompt` and one of job_id | token | seed | image_sha256 are required). Malformed refuses. */
export const PLAN_SOURCE_RE = /^(agent|text:[\w.@:/-]+|image:[\w.@:/-]+)$/;
export const PLAN_PROVENANCE_KIND = 'plan-reconstruction';
export function validatePlanAudit(audit, label = 'plan_audit') {
  if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return [`${label}: must be an object — { source: 'agent' | 'text:<model>' | 'image:<worker>', prompt?, job_id | token | seed | image_sha256? }`];
  const errors = [];
  if (typeof audit.source !== 'string' || !PLAN_SOURCE_RE.test(audit.source)) errors.push(`${label}.source: required — 'agent', 'text:<model>' (e.g. 'text:codex') or 'image:<worker>' (e.g. 'image:comfyui@127.0.0.1:8188')`);
  if (audit.source !== 'agent') {
    if (typeof audit.prompt !== 'string' || audit.prompt.trim().length < 8) errors.push(`${label}.prompt: required when a worker printed the plan — the request it was given (≥ 8 chars)`);
    const gen = audit.job_id ?? audit.token ?? audit.seed ?? audit.image_sha256;
    if (gen === undefined || gen === null || String(gen).trim() === '') errors.push(`${label}: required one of job_id | token | seed | image_sha256 — a handle on the worker's answer`);
  }
  return errors;
}

/** The plan door: expand the ring plan into the recipe, then mint as usual with the plan (and its audit) stored beside it. */
export async function createLayeredPlanHandler(input) {
  if (!input || typeof input !== 'object' || !input.plan || typeof input.plan !== 'object') {
    throw new Error("The plan door needs `plan` — { schema: 'layered-plan-v1', frame, joints, segments, details?, include?, dials?, rig?, clips? }. Read get_solid_vocab({ id: 'layered' }) (the Plan section); the worked plans are docs/examples/dragon-body/seed-recipe.mjs and docs/examples/ring-plans/.");
  }
  let provenance;
  if (input.plan_audit !== undefined) {
    const errors = validatePlanAudit(input.plan_audit);
    if (errors.length) throw new Error(`plan_audit refused:\n - ${errors.join('\n - ')}`);
    const { source, prompt, job_id, token, seed, image_sha256 } = input.plan_audit;
    provenance = { kind: PLAN_PROVENANCE_KIND, plan_audit: { source, ...(prompt ? { prompt } : {}), ...(job_id != null ? { job_id } : {}), ...(token != null ? { token } : {}), ...(seed != null ? { seed } : {}), ...(image_sha256 != null ? { image_sha256 } : {}) } };
  }
  let recipe;
  try { recipe = expandPlan(input.plan); }
  catch (err) { throw new Error(`${err.message} — manual: get_solid_vocab({ id: 'layered' }).`); }
  return createLayeredHandler({ ...input, recipe, ...(provenance ? { provenance } : {}) });
}

export async function createLayeredHandler(input) {
  if (!input || typeof input !== 'object' || !input.recipe || typeof input.recipe !== 'object' || !input.recipe.parts) {
    throw new Error("The layered kind needs `recipe` — { frame, parts: { <name>: { layer, slots, stations, caps | pin, offsets, faces } }, dials?, creases? }. Read get_solid_vocab({ id: 'layered' }); the worked recipe is docs/examples/dragon-layered/recipe.json.");
  }
  const { title, recipe, plan, provenance, dials, channels, units, facing, seat, toon, hullShade, rim, ref, folder_ref: folderRef } = input;
  const manifest = {
    kind: 'layered',
    ...(title ? { title } : {}),
    recipe,
    ...(plan && typeof plan === 'object' ? { plan } : {}),   // the authoring record, when the solid was minted through the plan door
    ...(provenance && typeof provenance === 'object' ? { provenance } : {}),   // who printed the plan (validated by the plan door)
    dials: resolveLayeredDials(recipe.dials || {}, dials || {}),   // every dial stored at its value, so a patch by path finds it
    ...(channels && typeof channels === 'object' ? { channels } : {}),
    units: typeof units === 'string' ? units : 'm',   // stored, not defaulted at read: measure_solid and the STL scale read the manifest's units
    ...(typeof facing === 'string' || Number.isFinite(facing) ? { facing } : {}),
    ...(seat === false ? { seat: false } : {}),
    ...(toon != null ? { toon: resolveToon(toon) ? toon : undefined } : {}),
    // the shader-look dials (opt-in, rigged recipes): hull-smooth bake normals and the figure rim —
    // stored as authored; the layered world resolve validates shapes on read
    ...(hullShade === true || (hullShade && typeof hullShade === 'object') ? { hullShade } : {}),
    ...(Array.isArray(rim) && rim.length === 5 && rim.every(Number.isFinite) ? { rim } : {}),
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
