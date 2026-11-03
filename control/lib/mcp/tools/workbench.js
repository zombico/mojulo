/**
 * create_workbench — mint a measured OBJECT vantage from a polygomer of lathe monomers.
 *
 * The object-scale sibling of create_fractal_city / create_transportation_hub: instead of a
 * traversable environment, it renders ONE everyday object (built by bonding primitive solids — a
 * candlestick = foot+stem+cup, a bottle, a dumbbell = bar+two bells) on a measured grid at literal
 * scale, for FORM accuracy. Fractal-generation path: the manifest stores ONLY the monomer recipe
 * (no geometry); the object is regenerated deterministically on render and served at
 * /api/sketches/<ref>/world (traversable three.js orbit) and /scene (preset CSS-3D shots).
 *
 * Stored manifest: { kind:'workbench', lathes:[ <lathe spec> … ], units?, viewBox?, title? }.
 *
 * Design: control/lib/graph/workbench.plan.md.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planWorkbench, persistedLedger } from '@/lib/graph/worlds/workbench';
import { resolveToon } from '@/lib/graph/polygonizer/vexar';
import { lowerAssembly } from '@/lib/graph/polygonizer/workbench-assembly';
import { LAWS_VERSION, stampArms, isArmsBuild } from '@/lib/graph/equipment/expand';
import { ARMS_LAWS_VERSION } from '@/lib/graph/equipment/arms/laws';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';
import { ensureExactKernel } from '@/lib/graph/polygonizer/field-exact';
import { validateCrystalLight } from '@/lib/graph/scene/crystal-rig';
import { normalizeHud, validateHudStyle } from '@/lib/graph/game/hud-widgets';
import { solidNext, checkedAsk } from '@/lib/mcp/tools/solid-next';

function normalizeToon(toon) {
  const t = resolveToon(toon);
  if (!t) throw new Error('`toon` must be `true` or `{ bands?: <tones ≥ 2>, ink?: true | { color, width, crease } }` — e.g. `toon: true` for three tones + outlines, `toon: { bands: 4 }` for tones only.');
  return t;
}

function checkedCrystalLight(spec) {
  const errs = validateCrystalLight(spec);
  if (errs.length) throw new Error(`crystalLight is invalid — see get_solid_vocab({ id: 'workbench' }), "Light rigs":\n- ${errs.join('\n- ')}`);
  return spec;
}

// the HUD rows and style the World refuses when it resolves (world-scene.js), refused here with the same words: the
// mint does not resolve the World, so a bad row used to mint ok and 500 the world link
function checkedEvents(ev) {
  if (Array.isArray(ev.hud) && ev.hud.length) {
    const h = normalizeHud(ev.hud);
    if (h.errors.length) throw new Error(`events.hud is invalid — see get_game_vocab({ id: 'hud-guide' }):\n- ${h.errors.join('\n- ')}`);
  }
  if (ev.style !== undefined) {
    const se = validateHudStyle(ev.style, 'events.style');
    if (se.length) throw new Error(`events.style is invalid — see get_game_vocab({ id: 'hud-style' }):\n- ${se.join('\n- ')}`);
  }
  return ev;
}

export function mintWorkbench({ title, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, frames, assembly, cuts, program, build, units, viewBox, facing, toon, grid, movers, crystalLight, events, fabricate, ask, ref, folderRef } = {}) {
  // Relative composition: an `assembly` declares parts by size + how they connect; lower it to
  // absolute monomers and merge with any explicit arrays (e.g. an assembled body + a hand-placed sweep).
  let baseLathes = Array.isArray(lathes) ? lathes : [];
  let baseExtrudes = Array.isArray(extrudes) ? extrudes : [];
  let baseLofts = Array.isArray(lofts) ? lofts : [];
  let baseFields = Array.isArray(fields) ? fields : [];
  if (assembly && typeof assembly === 'object') {
    const lowered = lowerAssembly(assembly);
    baseLathes = [...lowered.lathes, ...baseLathes];
    baseExtrudes = [...lowered.extrudes, ...baseExtrudes];
    baseLofts = [...lowered.lofts, ...baseLofts];
    baseFields = [...lowered.fields, ...baseFields];
  }
  const hasLathes = baseLathes.length > 0;
  const hasExtrudes = baseExtrudes.length > 0;
  const hasLofts = baseLofts.length > 0;
  const hasFields = baseFields.length > 0;
  const hasSweeps = Array.isArray(sweeps) && sweeps.length > 0;
  const hasDrapes = Array.isArray(drapes) && drapes.length > 0;
  const hasReliefs = Array.isArray(reliefs) && reliefs.length > 0;
  const hasShells = Array.isArray(shells) && shells.length > 0;
  const hasFrames = Array.isArray(frames) && frames.length > 0;
  const hasProgram = program && typeof program === 'object';
  const hasBuild = build && typeof build === 'object' && !Array.isArray(build);
  if (!hasLathes && !hasExtrudes && !hasSweeps && !hasLofts && !hasFields && !hasDrapes && !hasReliefs && !hasShells && !hasFrames && !hasProgram && !hasBuild) {
    throw new Error('Provide at least one monomer — a non-empty `lathes`, `extrudes`, `sweeps`, `lofts`, `fields`, `drapes`, `reliefs`, `shells`, `frames`, or `assembly` (the polygomer) — or a `program` (the code kind) or an equipment or furniture `build`.');
  }
  const manifest = {
    kind: 'workbench',
    // the code kind (expressiveness.plan.md E3): the program is a PARAM — it lives in the
    // manifest beside the monomer arrays and expands on every render (memoised)
    ...(hasProgram ? { program: { source: program.source, ...(program.params !== undefined ? { params: program.params } : {}), ...(program.seed !== undefined ? { seed: program.seed } : {}), ...(program.budgetMs !== undefined ? { budgetMs: program.budgetMs } : {}) } } : {}),
    // an equipment build (equipment/expand.js): the words are the recipe, expanded on every read, stamped with the
    // version of the laws it was minted under so a later refinement never moves it
    // (a furniture build, furnishings/asset.js, is a lock of resolved dials and needs no laws stamp); an arm takes its
    // item's default model when it names none (equipment/arms/index.js stampArms), so a new mint is drawn by the arms
    // kernel and a row minted before keeps the firearm samples' bytes
    ...(hasBuild ? { build: build.type === 'equipment' ? ((b) => ({ ...b, laws: b.laws ?? (isArmsBuild(b) ? ARMS_LAWS_VERSION : LAWS_VERSION) }))(stampArms(build)) : build } : {}),
    ...(hasLathes ? { lathes: baseLathes } : {}),
    ...(hasExtrudes ? { extrudes: baseExtrudes } : {}),
    ...(hasSweeps ? { sweeps } : {}),
    ...(hasLofts ? { lofts: baseLofts } : {}),
    ...(hasFields ? { fields: baseFields } : {}),
    ...(hasDrapes ? { drapes } : {}),
    ...(hasReliefs ? { reliefs } : {}),
    ...(hasShells ? { shells } : {}),
    ...(hasFrames ? { frames } : {}),
    // parts-booleans B1: the cut is stored AS a cut (the monomers stay in their arrays); the
    // rewrite to a field happens on every render, so an edit to a bore re-cuts
    ...(Array.isArray(cuts) && cuts.length ? { cuts } : {}),
    ...(typeof units === 'string' ? { units } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(typeof facing === 'string' || Number.isFinite(facing) ? { facing } : {}),
    // toon dial (toon-shading): stored normalized (`true` → { bands: 3, ink: true }); a malformed
    // value is refused rather than silently dropped
    ...(toon != null ? { toon: normalizeToon(toon) } : {}),
    // `grid` and `movers` are top-level spec keys on the card; until now only an update_sketch
    // patch could store them (the mint dropped both). Absent → byte-identical.
    ...(grid === false ? { grid: false } : {}),
    ...(Array.isArray(movers) && movers.length ? { movers } : {}),
    // a light rig over the recipe's crystals (Light rigs on the card), refused here with its errors named; `events`
    // (its targets' `lit` / `dark`, HUD banners) has its HUD rows and style checked here, the rest where it runs
    ...(crystalLight != null ? { crystalLight: checkedCrystalLight(crystalLight) } : {}),
    ...(events && typeof events === 'object' && !Array.isArray(events) ? { events: checkedEvents(events) } : {}),
    // fabricate_solid: the needs and the plan they resolved to, frozen beside the frames (./fabricate.js)
    ...(fabricate !== undefined ? { fabricate } : {}),
    // the size of the ask (./solid-next.js): caps `next`; absent → no key
    ...(checkedAsk(ask) ? { ask } : {}),
    ...(title ? { title } : {}),
  };

  // Lower once to validate the recipe is renderable + return a size/face readout (no geometry stored).
  // For the code kind this is the program's first run: a throw fails the mint with the error AND the
  // captured log (the agent's loop is mint → read → update_sketch).
  const { stats } = planWorkbench(manifest);
  // G6: the ledger travels with the recipe (recipe bytes, faces, closure) — export_model reads it
  // back beside the whole-object audit, so "closed at mint, open after an edit" is legible.
  manifest.ledger = persistedLedger(stats.ledger);

  const sketch = SketchRepository.create({
      title: title || `workbench · ${stats.monomers} monomer${stats.monomers === 1 ? '' : 's'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });

  warmScenePng(sketch);   // background pre-bake of the gallery preview PNG
  const next = solidNext(manifest);

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
    ...(next ? { next } : {}),
  };
}

/**
 * mint_solid kind 'code' — the code door (expressiveness.plan.md E3). `spec.source` is the body
 * of a function (params, ctx) that RETURNS a workbench spec (monomer arrays / assembly) or a
 * face list; `params` are the dials update_sketch turns; `seed` seeds the realm's Math.random;
 * `budgetMs` is the one limit. Stores a plain `kind:'workbench'` manifest carrying `program`,
 * so every leg (world, scene, skin, export, assembler parts, save_recipe) is inherited.
 */
// The equipment door: an item named by intent and direction (equipment/expand.js). Stores kind:'workbench' + `build`
// (the words, stamped with the laws), expanded on every read; explicit monomer arrays beside it are an author's own
// parts, merged after the build's.
export async function createEquipmentHandler(input) {
  if (!input || typeof input !== 'object' || typeof input.item !== 'string') {
    throw new Error("The equipment kind needs `item` (dagger | sword | greatsword | staff | bow | shield) and a `style` (a sample name or an inline card), with optional `dials` { stylize, mass, focus, ornament }, `parts`, `gem`, `seed`. Read get_solid_vocab({ id: 'equipment' }).");
  }
  const { title, item, style, dials, parts, gem, seed, laws, units, viewBox, facing, toon, grid, movers, crystalLight, events, ask, ref, folder_ref: folderRef, lathes, extrudes, sweeps, lofts, fields } = input;
  const build = { type: 'equipment', item,
    ...(style !== undefined ? { style } : {}), ...(dials !== undefined ? { dials } : {}), ...(parts !== undefined ? { parts } : {}),
    ...(gem !== undefined ? { gem } : {}), ...(seed !== undefined ? { seed } : {}), ...(laws !== undefined ? { laws } : {}) };
  const named = typeof style === 'string' ? style : style && style.id;
  await ensureExactKernel();
  return mintWorkbench({ title: title || [named, item].filter(Boolean).join(' '), lathes, extrudes, sweeps, lofts, fields, build,
    units: units || 'cm', viewBox, facing, toon, grid, movers, crystalLight, events, ask, ref, folderRef });
}

export async function createCodeSolidHandler(input) {
  if (!input || typeof input !== 'object' || typeof input.source !== 'string') {
    throw new Error("The code kind needs `source` — the body of a function (params, ctx) that returns a workbench spec ({ lathes | extrudes | sweeps | lofts | fields | drapes | reliefs | shells | assembly }) or a face list ([{ corners, fill?, group? }]). Read get_solid_vocab({ id: 'code' }) for the realm API and worked programs.");
  }
  const { title, source, params, seed, budgetMs, units, viewBox, facing, grid, movers, crystalLight, events, ask, ref, folder_ref: folderRef, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, cuts } = input;
  await ensureExactKernel(); // an `exact: true` field (from the program or beside it) needs Manifold loaded before the sync lowering
  return mintWorkbench({
    title, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, cuts,
    program: { source, params, seed, budgetMs },
    units, viewBox, facing, grid, movers, crystalLight, events, ask, ref, folderRef,
  });
}

export async function createWorkbenchHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_solid kind "workbench" requires a spec with a `lathes` array');
  }
  const { title, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, frames, assembly, cuts, program, build, units, viewBox, facing, toon, grid, movers, crystalLight, events, fabricate, ask, ref, folder_ref: folderRef } = input;
  await ensureExactKernel(); // an `exact: true` field or cut, or a frame's joints, need Manifold loaded before the sync lowering
  return mintWorkbench({ title, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, frames, assembly, cuts, program, build, units, viewBox, facing, toon, grid, movers, crystalLight, events, fabricate, ask, ref, folderRef });
}
