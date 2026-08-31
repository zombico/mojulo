/**
 * Split out of tools/sketches.js — see
 * lite-template/integration/_0828/mojulo-2.0-pure-creative.plan.md (Phase 1c).
 * sketches.js hosted six unrelated tool families in one 2038-line file; each
 * now owns its own module and sketches.js is the registration surface.
 */
// Model EXPORT (GLB / STL, print-purposed) and the mesh-render bind.


import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { outcomeDirFor, outcomeUrlFor } from '@/lib/outcomes-paths';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { facesToStl, isPrintableFace } from '@/lib/graph/scene/scene-stl';
import { glbToFaces } from '@/lib/graph/scene/scene-gltf-read';
import { nextMeshPath } from '@/lib/graph/scene/mesh-store';
import { auditClosure } from '@/lib/graph/polygonizer/face-closure';

/**
 * export_model — serialize a stored sketch's traversable World as a .glb or .stl.
 *
 * Resolves the SAME baked geometry the /world route renders (via the shared
 * world-scene seam), so the exported mesh matches the live World. `format: 'glb'`
 * (default) is the faithful depiction capture (vertex colours, named group nodes);
 * `format: 'stl'` is the 3D-printing handoff — bare binary triangle soup for
 * slicers, colour and grouping deliberately dropped, `scale` mapping world units
 * to millimetres. Returns the download URL plus, when `write` is true (default),
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
const UNIT_TO_MM = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
export function deriveStlScale(units) {
  if (typeof units !== 'string') return null;
  const mm = UNIT_TO_MM[units.trim().toLowerCase()];
  return Number.isFinite(mm) ? mm : null;
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
function auditStlClosure(payload) {
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
    `- format: ${format}${format === 'glb' && clips ? ` (animated — clips: ${clips === '_all' ? 'all' : clips.join(', ')})` : ''}`,
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
        `- scale: ×${print.scale} (${print.scaleNote}) — prints ${print.sizeMm.join(' × ')} mm`,
        `- closure: ${print.closure.audited
          ? (print.closure.closed
            ? 'closed — no significant open rims in the printable set'
            : `${print.closure.holes} open rim${print.closure.holes === 1 ? '' : 's'}, widest ≈${print.closure.widest}${print.units ? ` ${print.units}` : ' world units'} — the slicer's mesh repair must union these`)
          : `not audited (${print.closure.reason})`}`,
        '- the audit is advisory: intersecting shells still ship and slicers union them on import.',
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
    '- Axes: mojulo worlds are z-up; the GLB parents everything under a y-up-rotated `mojulo` root, so it imports upright with no axis settings. (STL stays raw z-up, units as millimetres.)',
    '- Animations: rig clips are baked at 1 second per cycle (looping clips repeat key 0 as a wrap key) — retime freely in the NLA/AnimationPlayer.',
    '- Level semantics ride glTF `extras` under the `moj:` namespace: `entity:<id>` nodes carry `moj:entity`/`moj:rule`/`moj:body`; the scene carries `moj:spawn`, `moj:colliders` (AABB boxes), and `moj:game` (contract summary). Cameras are mojulo\'s own framings.',
    '- Colours are baked vertex colours on unlit materials — the depiction is the asset; no lighting setup needed.',
    '',
  ].join('\n');
}
export async function exportModelHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('export_model requires { ref }');
  }
  const { ref, write = true, format = 'glb', scale: scaleInput, target_mm: targetMm, clips = null } = input;
  if (!ref || typeof ref !== 'string') {
    throw new Error('`ref` is required (string)');
  }
  if (typeof write !== 'boolean') {
    throw new Error('`write` must be a boolean if provided');
  }
  if (format !== 'glb' && format !== 'stl') {
    throw new Error("`format` must be 'glb' or 'stl' if provided");
  }
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
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) {
    throw new Error(`No sketch exists at ref '${ref}'`);
  }
  if (!sketch.manifest) {
    throw new Error(`Sketch '${ref}' has no manifest`);
  }

  const { payload, kind } = await resolveWorldScene(sketch);

  // Scale strategy by print profile. Precedence: explicit `scale` > `target_mm`
  // fit > the profile default (literal: `units` derivation — true scale is
  // structural, not agent arithmetic; everything else: fit to DEFAULT_TARGET_MM,
  // because a city or a galaxy has no true millimetre and deriving from a stray
  // `units` label would print a building at building scale).
  const profile = printProfileFor(kind ?? sketch.manifest.kind);
  const units = typeof sketch.manifest.units === 'string' ? sketch.manifest.units : null;
  let scale = 1;
  let scaleNote = 'default 1 — coordinates read as millimetres';
  if (format === 'stl' && payload) {
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

  const exported = payload
    ? (format === 'stl'
      ? facesToStl(payload, { scale, generator: `mojulo ${ref}` })
      : facesToGlb(payload, { generator: `mojulo ${ref}`, ...(clips != null ? { clips } : {}) }))
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
  if (format === 'glb') {
    result.nodes = exported.nodeCount;
    // level-as-layout semantics (I4) — reported when the payload carried them
    if (exported.cameraCount) result.cameras = exported.cameraCount;
    if (exported.entityCount) result.entity_nodes = exported.entityCount;
    if (clips != null) {
      result.animations = exported.animationCount ?? 0;
      result.animated_figures = exported.animatedFigures ?? [];
    }
  } else {
    // The print handoff: profile + scale + size + closure travel with the file.
    result.print_profile = profile;
    result.scale = scale;
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
    result.note =
      `${profileLine} STL is bare triangle soup for slicers: colour/groups dropped, water/decals/studio grid omitted, `
      + `repeats expanded, z-up, units read as mm (scale ${scaleNote}; prints ${result.size_mm.join(' × ')} mm). Not guaranteed manifold — `
      + "intersecting shells survive; let the slicer's mesh repair union them on import. "
      + closureLine;
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
    const hash = createHash('sha256').update(JSON.stringify(sketch.manifest)).digest('hex').slice(0, 16);
    await fs.writeFile(path.join(dir, 'recipe.json'), `${JSON.stringify(sketch.manifest, null, 2)}\n`);
    await fs.writeFile(
      path.join(dir, 'README.md'),
      buildModelReadme({
        sketch, ref, kind: kind ?? sketch.manifest.kind, format, hash, exported, clips,
        ...(format === 'stl' ? { print: { profile, scale, scaleNote, sizeMm: result.size_mm, closure: result.closure, units } } : {}),
      }),
    );
    result.path = file;
    result.dir = dir;
    result.download_url = `${outcomeUrlFor(ref)}model.${format}`;
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
export async function bindMeshRenderHandler(input) {
  const { ref, glb_path: glbPath, note, source } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('bind_mesh_render requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (!glbPath || typeof glbPath !== 'string') throw new Error('bind_mesh_render requires { glb_path }');
  const bytes = await fs.readFile(glbPath);
  // The machine gate: strict container validation + a full geometry decode.
  // glbToFaces throws descriptive errors on bad magic / chunk layout / JSON /
  // compressed or quantized geometry — reject before writing anything.
  const faces = glbToFaces(bytes);
  if (!faces.length) {
    throw new Error('the submitted GLB carries no triangle geometry — bind the refined mesh, not an empty scene');
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
      { source_path: glbPath, source: typeof source === 'string' && source ? source : null, bound_at: new Date().toISOString(), sha256, bytes: bytes.length, note: note || null, n: slot.n },
      null,
      2,
    ),
  );
  return {
    ok: true,
    ref: sketch.ref,
    n: slot.n,
    path: slot.path,
    bytes: bytes.length,
    sha256,
    triangles: faces.length,
    next:
      `Mesh bound (append-only slot ${slot.n}; latest wins). Place it in any world as static scenery via a `
      + `figures-map entry: figures: { <name>: { meshRef: '${sketch.ref}', transform?: { pos:[x,y,z], rotZ, scale } } } — `
      + 'it is lowered server-side to the standard face list, so /world, the stills, and export_model all render it. '
      + 'v1 decode keeps vertex colours / baseColor and node transforms; textures, animations, and skins are dropped.',
  };
}
