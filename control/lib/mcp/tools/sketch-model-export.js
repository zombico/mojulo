/**
 * Split out of tools/sketches.js — see
 * lite-template/integration/_0828/mojulo-2.0-pure-creative.plan.md (Phase 1c).
 * sketches.js hosted six unrelated tool families in one 2038-line file; each
 * now owns its own module and sketches.js is the registration surface.
 */
// Model EXPORT (GLB, the print-purposed STL / 3MF, and OpenUSD usda / usdz) and the mesh-render bind.


import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes-paths';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { facesToStl, isPrintableFace, printableShells, applyTransform } from '@/lib/graph/scene/scene-stl';
import { unionShells, shellsToInstances } from '@/lib/graph/scene/manifold-union';
import { fieldGrid } from '@/lib/graph/polygonizer/field-faces';
import { EXPR_GRAMMAR_VERSION } from '@/lib/graph/polygonizer/field-expr';
import { FIELD_DOMAIN_OPS } from '@/lib/graph/polygonizer/field-terms';
import { expandWorkbenchProgram, hasProgram } from '@/lib/graph/worlds/workbench-program';
import { lowerCuts } from '@/lib/graph/polygonizer/workbench-cuts';
import { facesTo3mf } from '@/lib/graph/scene/scene-3mf';
import { facesToUsda, facesToUsdz } from '@/lib/graph/scene/scene-usd';
import { glbToScene } from '@/lib/graph/scene/scene-gltf-read';
import { facesBox } from '@/lib/graph/scene/mesh-fit';
import { nextMeshPath } from '@/lib/graph/scene/mesh-store';
import { glbNodeInventory, compareReturnContract } from '@/lib/graph/scene/blender-gate';
import { existsSync } from 'node:fs';
import { auditClosure } from '@/lib/graph/polygonizer/face-closure';
import { printAdvisories, advisoryLines, resolvePrinter } from '@/lib/graph/scene/print-advisory';
import { printSoup, measurePrintability, measureLine } from '@/lib/graph/scene/print-measure';
import { unitMillimetres, declaredUnits } from '@/lib/graph/scene/world-units';
import { assessWorldTier } from '@/lib/graph/worlds/world-contract';
import { WALKABLE_WORLD_KINDS } from '@/lib/graph/sketch/sketch-manifest';

/**
 * export_model — serialize a stored sketch's traversable World as a .glb or .stl.
 *
 * Resolves the SAME baked geometry the /world route renders (via the shared
 * world-scene seam), so the exported mesh matches the live World. `format: 'glb'`
 * (default) is the faithful depiction capture (vertex colours, named group nodes);
 * `format: 'stl'` is the 3D-printing handoff — bare binary triangle soup for
 * slicers, colour and grouping deliberately dropped, `scale` mapping world units
 * to millimetres; `format: '3mf'` is the same printable set as a 3MF package —
 * millimetres declared IN the file, baked colours as basematerials, instanced
 * repeats as one object + build items (interchange-seams.plan.md seam 1);
 * `format: 'usda' | 'usdz'` is the OpenUSD interchange (seam 2) — z-up verbatim,
 * `metersPerUnit` from the recipe's declared units (true scale in AR Quick Look),
 * displayColor + PointInstancer + cameras + entity Xforms; usda writes its texture
 * sidecars beside it, usdz packs them into the one aligned file. Returns the download URL plus, when `write` is true (default),
 * an on-disk path the host agent can open or move. Sketches with no World form
 * return { ok:false, eligible:false }.
 *
 * Provenance parity with export_game (interchange.plan.md I4): the written file
 * lands in the sketch's OUTCOME folder (`data/outcomes/<ref>/model.<format>`)
 * beside `recipe.json` (the sovereign manifest, export_game's exact pattern)
 * and a short `README.md` (refs, manifest sha256/16, re-mint + import notes).
 * Re-exporting the same ref overwrites all three — the model file has always
 * been an overwrite-in-place derived snapshot, and its provenance pair tracks
 * it; bound artifacts in the same folder (mesh-<n>.glb etc.) stay append-only.
 */

// Declared-unit label → millimetre factor, for deriving the STL `scale` when
// the caller omits it. Only labels a manifest actually declares participate
// (workbench `units`); an unknown/absent label falls back to scale 1 with an
// in-band nudge — "true scale" should be structural, never agent arithmetic.
/** facesBounds(payload) → [w, d, h] over every face corner the GLB will carry, or null. */
export function facesBounds(payload = {}) {
  const faces = Array.isArray(payload.faces) ? payload.faces : [];
  let lo = [Infinity, Infinity, Infinity]; let hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    const corners = f && Array.isArray(f.corners) ? f.corners : [];
    for (const c of corners) {
      if (!Array.isArray(c) || c.length < 3) continue;
      for (let i = 0; i < 3; i += 1) { if (c[i] < lo[i]) lo[i] = c[i]; if (c[i] > hi[i]) hi[i] = c[i]; }
    }
  }
  return Number.isFinite(lo[0]) ? hi.map((h, i) => h - lo[i]) : null;
}

export function deriveStlScale(units) {
  return unitMillimetres(units);   // ONE table: scene/world-units.js (world-contract-tiers D1)
}

// Print profiles — what an STL of each kind honestly IS, driving the scale
// strategy and the in-band note. Advisory discrimination, never a gate: any
// kind with geometry still exports (suitability belongs to the operator).
//   literal  — a true-scale part: `units` derivation applies.
//   maquette — a miniature of a world-scale artifact: fit-to-size, never units.
//   study    — open surface shells by construction (figurine via a DCC
//              solidify pass): fit-to-size, closure audit skipped.
//   ornament — an abstract depiction as a desk object (the science/math
//              views, the fallback for unknown kinds): fit-to-size; scale is
//              MEANINGLESS, not merely unknown. Behaves like maquette except
//              in the note, so a misclassified future kind is cosmetic only.
const PRINT_PROFILES = {
  literal: new Set(['workbench', 'assembler', 'carved-solid', 'css3d-turntable', 'vehicle-instance']),
  study: new Set(['figure', 'manji-tree']),
  maquette: new Set([
    'fractal-city', 'condo-complex', 'school-complex', 'edifice', 'dungeon',
    'transportation-hub', 'subway-station', 'subway-building', 'floorplan',
    'restaurant', 'painted-landscape', 'planetary', 'controllable',
    'koenigsberg', 'math-structure',
  ]),
};
export function printProfileFor(kind) {
  for (const [profile, kinds] of Object.entries(PRINT_PROFILES)) {
    if (kinds.has(kind)) return profile;
  }
  return 'ornament';
}

// Fit-to-size default: when a non-literal export names no `scale` and no
// `target_mm`, the longest printed dimension lands here — a palm-size print.
const DEFAULT_TARGET_MM = 120;

// The export-time machine gate (advisory, never refusing): whole-object
// watertightness over the SAME printable set the STL ships — base faces plus
// each repeat template (holes in a template repeat once per instance). The
// mint-time lint (workbench.js) checks monomers one at a time and its verdict
// evaporates; this one travels with the artifact, in the result and README.
export function auditStlClosure(payload) {
  const base = (Array.isArray(payload.faces) ? payload.faces : []).filter(isPrintableFace);
  let holes = [];
  let boundaryEdges = 0;
  if (base.length) {
    const a = auditClosure(base);
    holes = a.holes.map((h) => ({ diameter: h.diameter, center: h.center }));
    boundaryEdges = a.boundaryEdgeCount;
  }
  for (const r of Array.isArray(payload.repeats) ? payload.repeats : []) {
    const tpl = (Array.isArray(r.template) ? r.template : []).filter(isPrintableFace);
    if (!tpl.length) continue;
    const a = auditClosure(tpl);
    const instances = Array.isArray(r.transforms) ? r.transforms.length : 0;
    for (let i = 0; i < instances; i += 1) holes.push(...a.holes.map((h) => ({ diameter: h.diameter, center: h.center })));
    boundaryEdges += a.boundaryEdgeCount * instances;
  }
  holes.sort((a, b) => b.diameter - a.diameter);
  return { audited: true, closed: holes.length === 0, holes: holes.length, widest: holes[0] ? Math.round(holes[0].diameter * 10) / 10 : null, boundary_edges: boundaryEdges };
}

// The export folder's README — refs + manifest hash + how to re-mint + how to
// import (axis convention, clip timing, extras namespace). Deliberately short:
// the recipe is the artifact of record, the README is the courier's note.
function buildModelReadme({ sketch, ref, kind, format, hash, exported, clips, print }) {
  const title = sketch.title || sketch.manifest?.title || ref;
  return [
    `# ${title}`,
    '',
    'A 3D model exported from [mojulo](https://github.com/zombico/mojulo) — recipes, not renders:',
    '`recipe.json` is the sovereign manifest; `model.' + format + '` is its deterministic derived snapshot.',
    '',
    '## Provenance',
    '',
    `- sketch ref: \`${ref}\``,
    `- kind: \`${kind}\``,
    `- manifest sha256/16: \`${hash}\``,
    `- format: ${format}${format === 'glb' && clips ? ` (animated — clips: ${clips === '_all' ? 'all' : clips.join(', ')})` : ''}${exported.quantized ? ' (KHR_mesh_quantization — int16 positions under dequantizing nodes; the extension is required)' : ''}${exported.lit ? ' (LIT — real pbrMetallicRoughness materials over an unshaded base; the importer\'s light is the only light)' : ''}`,
    `- exported: ${new Date().toISOString()}`,
    ...(print
      ? [
        '',
        '## Print notes',
        '',
        `- profile: ${print.profile} — ${{
          literal: 'a true-scale part',
          maquette: 'a miniature of a world-scale artifact, not true scale',
          study: 'a surface study printed as a figurine (solidify in a DCC first)',
          ornament: 'a desk object of an abstract depiction; scale has no physical meaning',
        }[print.profile]}`,
        `- scale: ×${print.scale} (${print.scaleNote}) — prints ${print.sizeMm.join(' × ')} mm${format === '3mf' ? ' (millimetres are declared in the file)' : ' (STL carries no units; slicers assume mm)'}`,
        `- closure: ${print.closure.audited
          ? (print.closure.closed
            ? 'closed — no significant open rims in the printable set'
            : `${print.closure.holes} open rim${print.closure.holes === 1 ? '' : 's'}, widest ≈${print.closure.widest}${print.units ? ` ${print.units}` : ' world units'} — the slicer's mesh repair must union these`)
          : `not audited (${print.closure.reason})`}`,
        '- the audit is advisory: intersecting shells still ship and slicers union them on import.',
        ...(print.ledger
          ? [`- ledger at last mint/edit: ${print.ledger.faces} faces, recipe ${print.ledger.recipe_bytes} bytes, per-monomer lint ${print.ledger.closed ? 'closed' : 'open'}${print.ledger.closed && print.closure.audited && !print.closure.closed ? ' — the whole-object audit above finds open rims the per-monomer lint excused (a declared-open monomer: caps:false / openFace, or an overlap seam)' : ''}`]
          : []),
        `- ${measureLine(print.measure)}`,
        ...advisoryLines(print.advisories, print.printer).map((l, i) => (i === 0 ? `- ${l}` : l)),
        '- advisories are two rungs against the printer profile: declared-feature arithmetic (walls, tube and neck diameters the recipe states) and the measurement above (overhang vs the self-support angle; walls SAMPLED by inward ray, not a true medial thickness; support volume is a column-to-bed bound) — the slicer measures the rest.',
      ]
      : []),
    '',
    '## How to re-mint',
    '',
    'On any host running mojulo, `recipe.json` is the world manifest: store it as a',
    `sketch (its \`kind\` names the minting tool) and \`export_model({ ref })\``,
    'regenerates this file deterministically — same recipe, same bytes.',
    '',
    '## Importing this file (Blender / Godot)',
    '',
    '- Axes and scale: mojulo worlds are z-up; the GLB parents everything under a y-up-rotated `mojulo` root, so it imports upright with no axis settings, and when the recipe declares a unit (`units:\'cm\'`, or a kind\'s own authoring unit) the root is scaled by it (`moj:metersPerUnit`) so importers receive metres at true size. (STL and 3MF stay raw z-up, units as millimetres — 3MF declares them, STL assumes them. USD declares `upAxis = "Z"` and `metersPerUnit` from the recipe, so it too imports upright at true scale.)',
    ...(format === 'usda' || format === 'usdz' ? ['- USD: one Mesh per render group with per-vertex `displayColor` (untextured meshes bind no material — viewers show the colour directly); textured groups bind a UsdPreviewSurface + UsdUVTexture; repeats are PointInstancers; entities are Xforms whose `moj:` extras ride customData; spawn / colliders / game ride the layer customLayerData. Rig clips are not in USD yet (UsdSkel is roadmap).'] : []),
    ...(format === '3mf' ? ['- 3MF: one object per shell (the base geometry, then each instanced repeat) placed by build items; baked colours ride `basematerials` — map them to filaments on a multi-material printer, ignore them otherwise.'] : []),
    '- Animations: rig clips are baked at 1 second per cycle (looping clips repeat key 0 as a wrap key) — retime freely in the NLA/AnimationPlayer.',
    '- Level semantics ride glTF `extras` under the `moj:` namespace: `entity:<id>` nodes carry `moj:entity`/`moj:rule`/`moj:body`; the scene carries `moj:spawn`, `moj:colliders` (AABB boxes), and `moj:game` (contract summary). Cameras are mojulo\'s own framings.',
    '- Colours are baked vertex colours on unlit materials — the depiction is the asset; no lighting setup needed.',
    '',
  ].join('\n');
}
/**
 * resolvePrintScale({ payload, profile, units, scaleInput, targetMm }) → { scale, scaleNote } —
 * the world-units → mm dial, ONE answer shared by export_model and measure_solid
 * (continuous-guardrails.plan.md G2: the number the agent reads is the number the print would
 * be). Precedence: explicit `scale` > `target_mm` fit > the profile default (literal: `units`
 * derivation — true scale is structural, not agent arithmetic; everything else: fit to
 * DEFAULT_TARGET_MM, because a city or a galaxy has no true millimetre and deriving from a stray
 * `units` label would print a building at building scale).
 */
export function resolvePrintScale({ payload, profile, units, scaleInput = null, targetMm = null } = {}) {
  let scale = 1;
  let scaleNote = 'default 1 — coordinates read as millimetres';
  if (payload) {
    const fitTo = (target, why) => {
      const probe = facesToStl(payload, { scale: 1 });
      const longest = probe ? Math.max(...probe.bounds.size) : 0;
      if (longest > 0) {
        scale = target / longest;
        scaleNote = `${why}: longest dimension ${Math.round(longest * 10) / 10} world units fit to ${target}mm (×${Math.round(scale * 1000) / 1000})`;
      }
    };
    if (scaleInput != null) {
      scale = scaleInput;
      scaleNote = `explicit \`scale\` ${scaleInput}`;
    } else if (targetMm != null) {
      fitTo(targetMm, 'fit to `target_mm`');
    } else if (profile === 'literal') {
      const derived = deriveStlScale(units);
      if (derived != null) {
        scale = derived;
        scaleNote = `derived from the manifest's units:'${units}' (1 ${units} = ${derived}mm)`;
      } else if (units) {
        scaleNote = `units:'${units}' has no known mm mapping — pass \`scale\` for a true-scale print`;
      } else {
        scaleNote = 'no units declared on the manifest — declare `units` or pass `scale` for a true-scale print';
      }
    } else {
      fitTo(DEFAULT_TARGET_MM, `${profile} default (pass \`target_mm\` or \`scale\` to choose)`);
    }
  }
  return { scale, scaleNote };
}

export async function exportModelHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('export_model requires { ref }');
  }
  const { ref, write = true, format = 'glb', scale: scaleInput, target_mm: targetMm, clips = null, skinned = false, quantize = false, humanoid = false, union = false, lit = false, printer: printerInput = null, strict = false } = input;
  if (!ref || typeof ref !== 'string') {
    throw new Error('`ref` is required (string)');
  }
  if (typeof write !== 'boolean') {
    throw new Error('`write` must be a boolean if provided');
  }
  const FORMATS = ['glb', 'stl', '3mf', 'usda', 'usdz'];
  if (!FORMATS.includes(format)) {
    throw new Error("`format` must be one of 'glb', 'stl', '3mf', 'usda', 'usdz' if provided");
  }
  const isUsd = format === 'usda' || format === 'usdz';
  // The two print formats share every print seam (profile, scale, closure, README notes).
  const isPrint = format === 'stl' || format === '3mf';
  if (scaleInput != null && (!Number.isFinite(scaleInput) || scaleInput <= 0)) {
    throw new Error('`scale` must be a positive number if provided');
  }
  if (targetMm != null && (!Number.isFinite(targetMm) || targetMm <= 0)) {
    throw new Error('`target_mm` must be a positive number if provided');
  }
  // animated GLB (interchange.plan.md I1): opt-in clip selection. Absent ⇒ byte-identical
  // static export (the char-safety line). glb-only — STL is a shape handoff.
  if (clips != null && clips !== '_all' && !(Array.isArray(clips) && clips.every((c) => typeof c === 'string'))) {
    throw new Error("`clips` must be an array of clip names, or '_all', if provided");
  }
  // skinned export (skin-over-mesh.plan.md phase 4): one SkinnedMesh + skins/IBM
  // per rig figure — the ENGINE deforms smooth flesh; mojulo's runtime keeps
  // rigid FK. Rides the clips path (a skin without joints animating is inert).
  if (skinned !== false && skinned !== true) throw new Error('`skinned` must be a boolean if provided');
  if (skinned && (clips == null || format !== 'glb')) {
    throw new Error("`skinned: true` needs `format: 'glb'` and a `clips` selection — the skin binds the animated joints");
  }
  // quantized GLB (interchange-seams.plan.md seam 6a): KHR_mesh_quantization on the static mesh
  // paths — about half the geometry bytes, no dependency. Off ⇒ byte-identical float export.
  if (quantize !== false && quantize !== true) throw new Error('`quantize` must be a boolean if provided');
  if (quantize && format !== 'glb') throw new Error("`quantize: true` applies to `format: 'glb'` only");
  // lit handoff (lit-handoff.plan.md step 1): real PBR materials over an UNSHADED base
  if (lit !== false && lit !== true) throw new Error('`lit` must be a boolean if provided');
  if (lit && format !== 'glb') throw new Error("`lit: true` applies to `format: 'glb'` only");
  // humanoid (interchange-seams.plan.md seam 3a): VRM bone names on the skinned joints + the
  // VRMC_vrm extension. Rides the skinned path (names belong to skin joints).
  if (humanoid !== false && humanoid !== true) throw new Error('`humanoid` must be a boolean if provided');
  if (humanoid && !skinned) throw new Error("`humanoid: true` needs `skinned: true` (and a `clips` selection) — the VRM names belong to the skin joints");
  // union (interchange-seams.plan.md seam 4a): a true CSG union of the printable shells via
  // Manifold before the print file is written — one solid with a measured volume instead of
  // overlapping shells the slicer must repair. Opt-in; absent the package it reports and ships plain.
  if (union !== false && union !== true) throw new Error('`union` must be a boolean if provided');
  if (union && !isPrint) throw new Error("`union: true` applies to the print formats ('stl' | '3mf') only");
  // continuous-guardrails.plan.md G3/G4: the printer profile words the advisories; `strict` is
  // the operator ASKING for a hard stop (opt-in — the default stays advisory, cad-aid doctrine).
  if (strict !== false && strict !== true) throw new Error('`strict` must be a boolean if provided');
  if (strict && !isPrint) throw new Error("`strict: true` applies to the print formats ('stl' | '3mf') only");
  const printer = resolvePrinter(printerInput);
  if (printerInput != null && !isPrint) throw new Error("`printer` applies to the print formats ('stl' | '3mf') only");
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) {
    throw new Error(`No sketch exists at ref '${ref}'`);
  }
  if (!sketch.manifest) {
    throw new Error(`Sketch '${ref}' has no manifest`);
  }

  // a lit export sources the UNSHADED payload (flat albedo, no mojulo Lambert / AO / material
  // darkening) so the importer's light is the only light on the geometry
  const { payload: resolvedPayload, kind } = await resolveWorldScene(sketch, lit ? { unshaded: true } : {});
  let payload = resolvedPayload;
  let unionResult = null;
  if (union && payload) {
    const shells = printableShells(payload);
    if (shells) {
      const r = await unionShells(shellsToInstances(shells, applyTransform));
      if (r.faces) {
        // the unioned solid replaces the printable set (already instanced; no repeats left)
        payload = { faces: r.faces };
        unionResult = { applied: true, ...r.stats };
      } else {
        unionResult = { applied: false, reason: r.reason, ...(r.stats || {}) };
      }
    }
  }

  // Scale strategy by print profile — see resolvePrintScale (shared with measure_solid).
  const profile = printProfileFor(kind ?? sketch.manifest.kind);
  // The label the manifest carries, else the kind family's authoring unit (the floorplan family
  // is feet and never says so itself) — world-units.js, the one table every leg reads.
  const declared = declaredUnits(sketch.manifest);
  const units = declared ? declared.units : null;
  let scale = 1;
  let scaleNote = 'default 1 — coordinates read as millimetres';
  if (isPrint && payload) ({ scale, scaleNote } = resolvePrintScale({ payload, profile, units, scaleInput, targetMm }));

  // USD declares its scale IN the layer: the recipe's declared units → metersPerUnit (1 = the
  // pinned MOJULO_UNITS when nothing is declared). Print-style fit/scale knobs do not apply.
  const unitMm = deriveStlScale(units);
  const metersPerUnit = unitMm != null ? unitMm / 1000 : 1;
  const usdOpts = { generator: `mojulo ${ref}`, title: sketch.title || sketch.manifest.title || ref, metersPerUnit };
  const exported = payload
    ? (format === 'stl'
      ? facesToStl(payload, { scale, generator: `mojulo ${ref}` })
      : format === '3mf'
        ? facesTo3mf(payload, { scale, generator: `mojulo ${ref}`, title: sketch.title || sketch.manifest.title || ref })
        : format === 'usda'
          ? facesToUsda(payload, usdOpts)
          : format === 'usdz'
            ? facesToUsdz(payload, usdOpts)
            : facesToGlb(payload, { generator: `mojulo ${ref}`, ...(clips != null ? { clips } : {}), ...(skinned ? { skinned } : {}), ...(quantize ? { quantize } : {}), ...(humanoid ? { humanoid } : {}), ...(lit ? { lit: true } : {}) }))
    : null;
  const url = `/api/sketches/${encodeURIComponent(ref)}/model.${format}`;
  if (!exported) {
    return {
      ok: false,
      eligible: false,
      ref,
      kind: kind ?? null,
      reason:
        'This sketch has no traversable World geometry to export. Model export covers the World '
        + 'kinds (cities, transportation hubs, subway interiors, painted-landscape terrain, '
        + 'workbench/assembler studies, vehicle instances, the science views, furnished rooms, '
        + 'posed figures, carved solids, and turntable solids). '
        + 'Flat diagrams and charts are not exportable.',
      scene_url: `/api/sketches/${encodeURIComponent(ref)}/scene`,
      svg_url: `/api/sketches/${encodeURIComponent(ref)}/svg`,
    };
  }

  const result = {
    ok: true,
    ref,
    kind: kind ?? null,
    format,
    url,
    bytes: exported.byteLength,
    vertices: exported.vertexCount,
    triangles: exported.triangleCount,
  };
  // field solids (field-solids.plan.md F4): the honest ledger says in numbers what the recipe could
  // not express sharply — every field edge rounds to about one grid cell. mm on the print formats.
  // the code kind (expressiveness.plan.md E3): the ledger reads the EXPANDED manifest (the
  // program's monomers are the ones that shipped) and says what ran, in numbers
  let ledgerManifest = sketch.manifest;
  if (hasProgram(sketch.manifest)) {
    const ex = expandWorkbenchProgram(sketch.manifest);
    ledgerManifest = ex.manifest;
    result.code = {
      source_hash: ex.program.source_hash,
      realm_version: ex.program.realm_version,
      budget_ms: ex.program.budget_ms,
      returned: ex.program.returned,
      ...(ex.program.monomers ? { monomers: ex.program.monomers } : {}),
      ...(ex.program.faces ? { faces: ex.program.faces } : {}),
      note: 'A program generated this part; the recipe stores the source (a param), not the faces. Same source + params + seed → the same faces, on any host running the same realm version.',
    };
  }
  // parts-booleans B1: a `cuts[]` recipe ships as the field it lowers to — the ledger reads the
  // lowered manifest, so the cut part is counted, and names each cut (`field_solids.cuts`).
  ledgerManifest = lowerCuts(ledgerManifest);
  const fieldSpecs = Array.isArray(ledgerManifest.fields) ? ledgerManifest.fields : [];
  if (fieldSpecs.length) {
    const grids = fieldSpecs.map((f) => { try { return fieldGrid(f); } catch { return null; } }).filter(Boolean);
    const cellsList = grids.map((g) => g.cells);
    const coarsest = grids.length ? Math.max(...grids.map((g) => g.cell)) : null;
    const cutRows = fieldSpecs.map((f, i) => (f && f.cut ? { ...f.cut, ...(grids[i] ? { edge_rounding: Math.round(grids[i].cell * (isPrint ? scale : 1) * 1000) / 1000 } : {}) } : null)).filter(Boolean);
    result.field_solids = {
      count: fieldSpecs.length,
      cells: cellsList.length === 1 ? cellsList[0] : cellsList,
      ...(coarsest != null ? {
        edge_rounding: Math.round(coarsest * (isPrint ? scale : 1) * 1000) / 1000,
        edge_rounding_unit: isPrint ? 'mm' : (units || 'world units'),
      } : {}),
      ...(cutRows.length ? { cuts: cutRows } : {}),
      note: 'Field solids (the `fields` monomer) round every edge to about one grid cell — raise `cells` (≤128) for a finer edge; a machined sharp edge is `union: true` (Manifold, print formats) or the DCC.',
    };
    // expressiveness.plan.md E1/E2: expression terms ride a versioned grammar, warps make the
    // field a bound rather than a distance — both are said here, in numbers.
    const walk = (terms, acc) => {
      for (const t of Array.isArray(terms) ? terms : []) {
        if (t && t.shape && t.shape.kind === 'expr') acc.expr += 1;
        if (t && FIELD_DOMAIN_OPS.includes(t.op)) { acc.ops.add(t.op); if (['twist', 'bend', 'taper'].includes(t.op)) acc.warps += 1; }
        if (t && Array.isArray(t.terms)) walk(t.terms, acc);
      }
      return acc;
    };
    const tally = fieldSpecs.reduce((acc, f) => walk(f.terms, acc), { expr: 0, ops: new Set(), warps: 0 });
    if (tally.expr) {
      result.field_solids.expr_terms = tally.expr;
      result.field_solids.expr_grammar_version = EXPR_GRAMMAR_VERSION;
      result.field_solids.expr_note = 'An `expr` term is a field with the right sign, an exact distance only if authored as one — round / shell / blend over it are approximate by the same amount.';
    }
    if (tally.ops.size) {
      result.field_solids.domain_ops = [...tally.ops];
      if (tally.warps) result.field_solids.warp_note = 'After twist / bend / taper the field is a bound, not an exact distance — vertices sit a hair off; closure is unaffected.';
    }
  }
  if (format === 'glb') {
    result.nodes = exported.nodeCount;
    // The root carries the recipe's unit (scene-gltf rootScale, from resolveWorldScene's
    // metersPerUnit): report it, with the world-unit bounds, so the Blender verify gate
    // (usd-gate.js compareUsdGate) can check the imported size in metres — it read `null`
    // here and passed a 9 m mug (launch-falls-short.plan.md P1). Absent a unit ⇒ no fields.
    if (Number.isFinite(exported.metersPerUnit) && exported.metersPerUnit > 0) {
      result.meters_per_unit = exported.metersPerUnit;
      // bounds of what the GLB actually carries (every face, studio grid included — the reader
      // measures the whole file), not the printable set the STL probe filters to
      const fb = facesBounds(payload);
      if (fb) result.size_units = fb.map((v) => Math.round(v * 1000) / 1000);
      result.units_note = `the \`mojulo\` root is scaled ×${exported.metersPerUnit} (moj:metersPerUnit, from ${declared ? (declared.source === 'kind' ? `the ${sketch.manifest.kind} family's authoring unit '${units}'` : `units:'${units}'`) : 'the recipe'}) so importers receive metres — a ${units ?? 'unit'}-authored part lands at true size in Blender, Godot, Unity and Unreal.`;
    }
    // level-as-layout semantics (I4) — reported when the payload carried them
    if (exported.cameraCount) result.cameras = exported.cameraCount;
    if (exported.entityCount) result.entity_nodes = exported.entityCount;
    if (clips != null) {
      result.animations = exported.animationCount ?? 0;
      result.animated_figures = exported.animatedFigures ?? [];
      if (exported.skinnedFigures) result.skinned_figures = exported.skinnedFigures;
      if (exported.humanoidFigures) {
        result.humanoid_figures = exported.humanoidFigures;
        result.humanoid_note = 'VRM 1.0 bone names on the skin joints (hips / spine / head / left+rightUpperArm…Foot; weightless leaf joints at the wrists and ankles stand in for hands / feet) + the VRMC_vrm extension on the first figure. '
          + 'Honest limits: the skeleton is FLAT (absolute rotations, no parent chain) and the rest pose is the figure\'s stand, not a T-pose — VRM-aware tools address the bones by name today; a strict validator or Unity Humanoid auto-config wants the parent-local hierarchy (seam 3a-ii).';
      }
    }
    if (exported.lit) {
      result.lit = true;
      result.lit_note = 'Real pbrMetallicRoughness materials (metallic 0, roughness 0.85; no KHR_materials_unlit) over the UNSHADED payload — '
        + 'Blender, Godot, Unity and three.js light it on import; the Unreal pack pairs it with the M_MojuloLit master (pass --lit to export-unreal). '
        + 'The web runtime stays unlit; this is a handoff mode.';
    }
    if (exported.quantized) {
      result.quantized = true;
      result.quantize_step = Math.round(exported.quantizeStep * 1e6) / 1e6;
      result.note = `KHR_mesh_quantization: positions as int16 under per-mesh dequantizing nodes (coarsest step ${result.quantize_step}${units ? ` ${units}` : ' world units'}), colours uint16, normals int8. `
        + 'Importers that support the extension (Blender, glTFast/Unity, Unreal, Godot, three.js) read it; the extension is REQUIRED, so a reader without it refuses the file — re-export without `quantize` for those.';
    }
  } else if (isUsd) {
    result.nodes = exported.nodeCount;
    result.meters_per_unit = metersPerUnit;
    if (exported.bounds) result.size_units = exported.bounds.size.map((v) => Math.round(v * 1000) / 1000);
    if (exported.cameraCount) result.cameras = exported.cameraCount;
    if (exported.entityCount) result.entity_nodes = exported.entityCount;
    if (exported.instancerCount) result.instancers = exported.instancerCount;
    if (exported.textureCount) result.textures = exported.textureCount;
    if (format === 'usdz') result.files = exported.files;
    result.note =
      `OpenUSD ${format === 'usdz' ? 'package (uncompressed, 64-byte aligned — AR Quick Look opens it on iOS / visionOS)' : 'text layer'}: z-up verbatim (upAxis Z), `
      + `metersPerUnit ${metersPerUnit}${unitMm != null ? ` (from ${declared.source === 'kind' ? `the ${sketch.manifest.kind} family's authoring unit '${units}'` : `units:'${units}'`})` : ' (no units declared — 1 unit = 1 m)'}, `
      + 'baked colours as per-vertex displayColor (viewers LIGHT it — the depiction reads as albedo, not the unlit web look), '
      + 'instanced repeats as PointInstancers, level cameras as Camera prims, entities as Xforms with moj: customData. '
      + 'Not exported in v1: rig figures / clips (UsdSkel waits on the humanoid map), per-instance tints.'
      + (format === 'usda' && exported.sidecars.length ? ` Texture sidecars: ${exported.sidecars.map((s) => s.name).join(', ')} (written beside the file).` : '');
  } else {
    // The print handoff: profile + scale + size + closure travel with the file.
    if (format === '3mf') {
      result.objects = exported.objectCount;
      result.items = exported.itemCount;
      result.colors = exported.colorCount;
      if (exported.colorBits < 8) result.color_bits = exported.colorBits;
    }
    result.print_profile = profile;
    result.scale = scale;
    if (unionResult) {
      result.union = unionResult;
      if (unionResult.applied && Number.isFinite(unionResult.volume)) result.union.volume_mm3 = Math.round(unionResult.volume * scale * scale * scale * 100) / 100;
    }
    result.size_mm = exported.bounds.size.map((v) => Math.round(v * 10) / 10);
    result.closure = profile === 'study'
      ? { audited: false, reason: `'${kind ?? sketch.manifest.kind}' is a surface study — open shells by construction; run a DCC solidify pass (Blender) for a printable figurine` }
      : auditStlClosure(payload);
    const closureLine = result.closure.audited
      ? (result.closure.closed
        ? 'Closure audit: closed — no significant open rims.'
        : `Closure audit: ${result.closure.holes} open rim${result.closure.holes === 1 ? '' : 's'}, widest ≈${result.closure.widest}${units ? ` ${units}` : ' world units'} — the slicer's mesh repair must union these.`)
      : `Closure audit skipped: ${result.closure.reason}.`;
    const profileLine = {
      literal: 'A true-scale part.',
      maquette: 'A MINIATURE of a world-scale artifact — not true scale.',
      study: 'A surface study printed as a figurine — not a solid part.',
      ornament: 'A desk-object print of an abstract depiction — scale has no physical meaning.',
    }[profile];
    const unionLine = !unionResult ? ''
      : unionResult.applied
        ? ` Manifold union: ${unionResult.unioned} shell${unionResult.unioned === 1 ? '' : 's'} → ONE solid, volume ${result.union.volume_mm3} mm³, genus ${unionResult.genus}${unionResult.non_manifold.length ? `; left out as non-manifold: ${unionResult.non_manifold.map((n) => n.name).join(', ')}` : ''}.`
        : ` Union NOT applied: ${unionResult.reason}.`;
    result.printer = printer;
    if (sketch.manifest.ledger && typeof sketch.manifest.ledger === 'object') result.ledger = sketch.manifest.ledger; // G6: what the last mint/edit measured
    // Rung 2 (text-to-cad-seam T2): overhang / support / sampled walls over the very soup the
    // file carries (post-union when `union: true`), at the printed scale.
    const soup = printSoup(payload, { scale });
    result.print_measure = soup ? measurePrintability({ positions: soup, printer }) : null;
    result.print_advisories = printAdvisories({ manifest: sketch.manifest, scale, sizeMm: result.size_mm, printer, measure: result.print_measure });
    const measureNote = ` ${measureLine(result.print_measure)[0].toUpperCase()}${measureLine(result.print_measure).slice(1)}.`;
    const advisoryNote = measureNote + (result.print_advisories.length
      ? ` Print advisories (${result.print_advisories.length}): ${result.print_advisories.map((r) => `${r.kind} — ${r.detail}`).join('; ')}.`
      : ' Print advisories: none — declared features clear the wall floor, the sampled walls and overhang clear the profile, and the part fits the bed.');
    result.note = (format === '3mf'
      ? `${profileLine} 3MF for slicers (PrusaSlicer / Bambu / Orca / Cura): millimetres declared in the file, baked colours as `
        + `${result.colors} basematerial${result.colors === 1 ? '' : 's'}${result.color_bits ? ` (palette quantized to ${result.color_bits} bits/channel)` : ''}, `
        + `${result.objects} object${result.objects === 1 ? '' : 's'} placed by ${result.items} build item${result.items === 1 ? '' : 's'} (repeats stay instanced), `
        + `water/decals/studio grid omitted, z-up (scale ${scaleNote}; prints ${result.size_mm.join(' × ')} mm). Shells are separate objects, not a boolean union — `
        + 'the slicer merges them on import. '
        + closureLine
      : `${profileLine} STL is bare triangle soup for slicers: colour/groups dropped, water/decals/studio grid omitted, `
        + `repeats expanded, z-up, units read as mm (scale ${scaleNote}; prints ${result.size_mm.join(' × ')} mm). Not guaranteed manifold — `
        + "intersecting shells survive; let the slicer's mesh repair union them on import. "
        + closureLine) + unionLine + advisoryNote;
    if (strict) {
      const reasons = [];
      if (result.closure.audited && !result.closure.closed) reasons.push(`closure: ${result.closure.holes} open rim${result.closure.holes === 1 ? '' : 's'}, widest ≈${result.closure.widest}`);
      if (unionResult && !unionResult.applied) reasons.push(`union not applied: ${unionResult.reason}`);
      for (const r of result.print_advisories) reasons.push(`${r.kind}: ${r.detail}`);
      if (reasons.length) {
        throw new Error(`strict: refusing to write model.${format} for '${ref}' — ${reasons.join('; ')}. Re-run without \`strict\` to ship anyway (the default is advisory; suitability is yours).`);
      }
    }
  }
  if (write) {
    // Provenance parity with export_game (interchange.plan.md I4): the model file lands in
    // the sketch's outcome folder beside its sovereign recipe + README. Overwrite-in-place
    // on re-export (the model has always been a regenerated snapshot, and its provenance
    // pair tracks it); the folder's append-only convention applies to BOUND artifacts
    // (mesh-<n>.glb, render-<n>.png), which these filenames never collide with.
    const dir = outcomeDirFor(ref);
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `model.${format}`);
    await fs.writeFile(file, exported.bytes);
    // usda references its textures by relative path — write them beside it (usdz carries them inside).
    for (const sc of (format === 'usda' ? exported.sidecars : [])) {
      const scPath = path.join(dir, sc.name);
      await fs.mkdir(path.dirname(scPath), { recursive: true });
      await fs.writeFile(scPath, sc.bytes);
    }
    const hash = createHash('sha256').update(JSON.stringify(sketch.manifest)).digest('hex').slice(0, 16);
    await fs.writeFile(path.join(dir, 'recipe.json'), `${JSON.stringify(sketch.manifest, null, 2)}\n`);
    await fs.writeFile(
      path.join(dir, 'README.md'),
      buildModelReadme({
        sketch, ref, kind: kind ?? sketch.manifest.kind, format, hash, exported, clips,
        ...(isPrint ? { print: { profile, scale, scaleNote, sizeMm: result.size_mm, closure: result.closure, units, advisories: result.print_advisories, measure: result.print_measure, printer, ledger: result.ledger ?? null } } : {}),
      }),
    );
    result.path = file;
    result.dir = dir;
    result.download_url = `${outcomeUrlFor(ref)}model.${format}`;
  }
  // The world contract (world-contract-tiers W1): a walkable world's export echoes the tier its
  // payload declares and what the next tier needs — the same row the engine packs carry.
  if (payload && WALKABLE_WORLD_KINDS.includes(kind ?? sketch.manifest.kind)) {
    const a = assessWorldTier(payload, { walkable: true });
    result.contract = { tier: a.tier, next: a.next, missing_for_next: a.missing_for_next, ...(a.advisories.length ? { advisories: a.advisories } : {}) };
  }
  return result;
}


/**
 * bind_mesh_render — the bind-back door for INBOUND derived geometry
 * (interchange.plan.md I3). The operator's agent exports a world/figure via
 * export_model, refines the .glb externally (Blender, typically driven over
 * blender-mcp), and hands the refined file back here: snapshotted append-only
 * into the sketch's outcome folder (`data/outcomes/<ref>/mesh-<n>.glb`) with a
 * provenance sidecar beside it. The GLB is structurally validated AND fully
 * decoded at the door (scene-gltf-read.js — the machine gate), so a non-GLB or
 * a compressed/empty file is refused loudly before anything lands on disk.
 * The mesh is DERIVED, never the artifact: no geometry enters the manifest;
 * worlds place it by ref via a figures-map `meshRef` entry (world-scene.js).
 */
const manifestHashOf = (manifest) => createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0, 16);

/**
 * bindMeshBytes(sketch, bytes, { sourcePath, source, note }) → { slot, sha256, faces,
 *   textures, ledger, manifestHash, contract }
 * — the shared bind-back door: strict GLB validation + a full decode (the
 * machine gate, BEFORE anything lands on disk), then the append-only mesh slot
 * + its provenance sidecar. bind_mesh_render (manual) and the mesh handoff's
 * submit (durable, interchange-seams.plan.md seam 5) both go through here.
 *
 * The sidecar carries the HEAD manifest hash at bind time (export-blender.plan.md
 * D7 — `describeBoundMeshes` derives staleness from it later) and the decode
 * ledger (seam 6b: albedo textures carried, other maps counted). When a Blender
 * pack exists for the sketch (`<outcomes>/<ref>/blender/pack.json`), the return is
 * measured against its greybox contract (compareReturnContract) and the
 * `contract_drift` rows ride the sidecar + the result — advisory, never a refusal
 * (D4: a HAND return's drift is a finding; the handoff's own size gate is where a
 * WORKER return that came back re-scaled is refused at accept).
 */
export async function bindMeshBytes(sketch, bytes, { sourcePath = null, source = null, note = null, scale = null, sourceUnits = null } = {}) {
  const scene = glbToScene(bytes);
  const { faces, textures, ledger } = scene;
  if (!faces.length) {
    throw new Error('the submitted GLB carries no triangle geometry — bind the refined mesh, not an empty scene');
  }
  // text-to-cad-seam.plan.md T4: a CAD tool's GLB is exactly right in ITS unit (millimetres, by
  // construction); the conversion into the sketch's world units rides the SIDECAR, never the
  // bytes — the meshRef lowering composes `scale_applied` into the placement transform.
  const scaleApplied = Number.isFinite(scale) && scale > 0 && scale !== 1 ? scale : null;
  const manifestHash = manifestHashOf(sketch.manifest);
  let contract = null;
  const packPath = path.join(outcomeDirFor(sketch.ref), 'blender', 'pack.json');
  if (existsSync(packPath)) {
    try {
      const pack = JSON.parse(await fs.readFile(packPath, 'utf8'));
      const cmp = compareReturnContract({ pack, inventory: glbNodeInventory(bytes) });
      contract = { pack_manifest_hash: pack.manifestHash ?? null, pack_stale: !!pack.manifestHash && pack.manifestHash !== manifestHash, ...cmp };
    } catch (e) {
      contract = { error: `pack.json unreadable — contract not measured (${e?.message ?? e})` };
    }
  }
  const slot = nextMeshPath(sketch.ref);
  await fs.writeFile(slot.path, bytes);
  // Provenance rides a sidecar next to the slot (the recipe stays clean).
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(
    slot.sidecarPath,
    JSON.stringify(
      // `source` is the structured which-tool tag (parity with the image seam's
      // source column); `note` stays the free-text what-changed line.
      {
        source_path: sourcePath, source: typeof source === 'string' && source ? source : null, bound_at: new Date().toISOString(), sha256, bytes: bytes.length, note: note || null, n: slot.n,
        manifest_hash: manifestHash,
        ...(scaleApplied ? { source_units: sourceUnits || null, scale_applied: scaleApplied } : {}),
        textures: ledger.textures_carried.map((t) => t.key),
        ...(ledger.textures_dropped.length ? { textures_dropped: ledger.textures_dropped } : {}),
        ...(Object.values(ledger.maps_dropped).some(Boolean) ? { maps_dropped: ledger.maps_dropped } : {}),
        ...(contract ? { contract } : {}),
      },
      null,
      2,
    ),
  );
  return { slot, sha256, faces, textures, ledger, manifestHash, contract, scaleApplied };
}

// The unit → world-units factor for a bound GLB (T4). `units` names the FILE's unit; the sketch's
// own declared unit (manifest `units`, else the kind's authoring unit) is the target. A bare
// numeric `scale` wins. Null when nothing was asked (world units assumed, as always).
function boundMeshScale(sketch, { units = null, scale = null } = {}) {
  if (scale != null) {
    if (!(Number.isFinite(scale) && scale > 0)) throw new Error('`scale` must be a positive number (file units → world units)');
    return { scale, sourceUnits: units || null };
  }
  if (units == null) return { scale: null, sourceUnits: null };
  const fileMm = unitMillimetres(units);
  if (fileMm == null) throw new Error(`\`units\` must be one of mm | cm | m | in | ft (got '${units}')`);
  const declared = declaredUnits(sketch.manifest);
  const worldMm = declared ? unitMillimetres(declared.units) : null;
  if (worldMm == null) {
    throw new Error(`sketch '${sketch.ref}' declares no unit (no manifest \`units\` and its kind has no authoring unit), so \`units: '${units}'\` has nothing to convert into — pass a numeric \`scale\` instead`);
  }
  return { scale: fileMm / worldMm, sourceUnits: units };
}

export async function bindMeshRenderHandler(input) {
  const { ref, glb_path: glbPath, note, source, units = null, scale: scaleInput = null, expected_box: expectedBox = null } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('bind_mesh_render requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (!glbPath || typeof glbPath !== 'string') throw new Error('bind_mesh_render requires { glb_path }');
  const { scale, sourceUnits } = boundMeshScale(sketch, { units, scale: scaleInput });
  if (expectedBox != null && !(expectedBox && Array.isArray(expectedBox.min) && Array.isArray(expectedBox.max) && expectedBox.min.length === 3 && expectedBox.max.length === 3)) {
    throw new Error('`expected_box` must be { min: [x,y,z], max: [x,y,z] } in the FILE\'s units');
  }
  const bytes = await fs.readFile(glbPath);
  const { slot, sha256, faces, ledger, manifestHash, contract, scaleApplied } = await bindMeshBytes(sketch, bytes, { sourcePath: glbPath, source, note, scale, sourceUnits });
  // The size gate the worker path runs against the greybox, here against the CAD tool's OWN box
  // (both in file units, before the scale): 0.5×–2× per axis catches a ×10 / ×25.4 slip.
  let machine = null;
  if (expectedBox) {
    const got = facesBox(faces);
    const gotSize = [0, 1, 2].map((k) => got.max[k] - got.min[k]);
    const expSize = [0, 1, 2].map((k) => Number(expectedBox.max[k]) - Number(expectedBox.min[k]));
    const sizeAgrees = [0, 1, 2].every((k) => (expSize[k] < 1e-6 ? true : gotSize[k] >= expSize[k] * 0.5 && gotSize[k] <= expSize[k] * 2));
    machine = { size_file_units: gotSize.map((v) => Math.round(v * 1000) / 1000), expected_size: expSize.map((v) => Math.round(v * 1000) / 1000), size_agrees: sizeAgrees };
  }
  const driftLine = contract?.contract_drift
    ? (contract.contract_drift.length
      ? ` CONTRACT DRIFT (advisory, measured against the Blender pack): ${contract.contract_drift.length} row${contract.contract_drift.length === 1 ? '' : 's'} — ${contract.contract_drift.slice(0, 4).map((d) => `${d.node} ${d.kind}`).join(', ')}${contract.contract_drift.length > 4 ? ', …' : ''}; form changes belong upstream in the recipe.`
      : ' Contract check against the Blender pack: no drift — the form came back as shipped.')
    + (contract.pack_stale ? ' The pack itself predates the current recipe (re-pack before the next pass).' : '')
    : '';
  const texLine = ledger.textures_carried.length
    ? ` ${ledger.textures_carried.length} albedo texture${ledger.textures_carried.length === 1 ? '' : 's'} carried (${ledger.textures_carried.map((t) => t.key).join(', ')}).`
    : '';
  const dropLine = ledger.textures_dropped.length || Object.values(ledger.maps_dropped).some(Boolean)
    ? ` Not carried: ${[...ledger.textures_dropped.map((t) => `${t.key} (${t.reason})`), ...Object.entries(ledger.maps_dropped).filter(([, n]) => n).map(([k, n]) => `${n} ${k} map${n === 1 ? '' : 's'}`)].join(', ')}.`
    : '';
  return {
    ok: true,
    ref: sketch.ref,
    n: slot.n,
    path: slot.path,
    bytes: bytes.length,
    sha256,
    triangles: faces.length,
    manifest_hash: manifestHash,
    textures: ledger.textures_carried.map((t) => t.key),
    ...(ledger.textures_dropped.length ? { textures_dropped: ledger.textures_dropped } : {}),
    ...(Object.values(ledger.maps_dropped).some(Boolean) ? { maps_dropped: ledger.maps_dropped } : {}),
    ...(contract ? { contract } : {}),
    ...(scaleApplied ? { source_units: sourceUnits, scale_applied: Math.round(scaleApplied * 1e6) / 1e6 } : {}),
    ...(machine ? { machine } : {}),
    next:
      `Mesh bound (append-only slot ${slot.n}; latest wins).${driftLine}${texLine}${dropLine}`
      + (scaleApplied ? ` Units: the file's ${sourceUnits || 'declared'} units land in the sketch's world units at ×${Math.round(scaleApplied * 1e6) / 1e6} (recorded on the sidecar; the bytes are untouched; every meshRef placement inherits it).` : '')
      + (machine ? (machine.size_agrees ? ` Size gate: the decoded box agrees with expected_box (${machine.size_file_units.join(' × ')} vs ${machine.expected_size.join(' × ')}).` : ` SIZE GATE FAILED: decoded ${machine.size_file_units.join(' × ')} vs expected ${machine.expected_size.join(' × ')} — a unit slip or a re-centred export; check \`units\` before placing it.`) : '')
      + (source && /cad|freecad|onshape|fusion|step/i.test(String(source)) ? ' Ledger for a CAD-born part: B-rep exactness does not travel (this is a tessellation at the tool\'s deflection), nor do assembly joints / mates or materials beyond a base colour; keep the .step beside your recipe — it is the source there. The Blender `contract` block, if present, is the art-pass return\'s check and reads informational for any other producer.' : '')
      + ' Place it in any world as static scenery via a '
      + `figures-map entry: figures: { <name>: { meshRef: '${sketch.ref}', transform?: { pos:[x,y,z], rotZ, scale } } } — `
      + 'it is lowered server-side to the standard face list, so /world, the stills, and export_model all render it. '
      + 'The decode keeps vertex colours / baseColor, node transforms and albedo textures (TEXCOORD_0 + embedded PNG/JPEG); normal / roughness / metallic maps, animations and skins are dropped and counted.',
  };
}
