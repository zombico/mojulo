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
import { registerTool } from '@/lib/mcp/server';
import { planWorkbench, persistedLedger } from '@/lib/graph/worlds/workbench';
import { lowerAssembly } from '@/lib/graph/polygonizer/workbench-assembly';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

export function mintWorkbench({ title, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, assembly, cuts, program, units, viewBox, facing, ref, folderRef } = {}) {
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
  const hasProgram = program && typeof program === 'object';
  if (!hasLathes && !hasExtrudes && !hasSweeps && !hasLofts && !hasFields && !hasDrapes && !hasReliefs && !hasShells && !hasProgram) {
    throw new Error('Provide at least one monomer — a non-empty `lathes`, `extrudes`, `sweeps`, `lofts`, `fields`, `drapes`, `reliefs`, `shells`, or `assembly` (the polygomer) — or a `program` (the code kind).');
  }
  const manifest = {
    kind: 'workbench',
    // the code kind (expressiveness.plan.md E3): the program is a PARAM — it lives in the
    // manifest beside the monomer arrays and expands on every render (memoised)
    ...(hasProgram ? { program: { source: program.source, ...(program.params !== undefined ? { params: program.params } : {}), ...(program.seed !== undefined ? { seed: program.seed } : {}), ...(program.budgetMs !== undefined ? { budgetMs: program.budgetMs } : {}) } } : {}),
    ...(hasLathes ? { lathes: baseLathes } : {}),
    ...(hasExtrudes ? { extrudes: baseExtrudes } : {}),
    ...(hasSweeps ? { sweeps } : {}),
    ...(hasLofts ? { lofts: baseLofts } : {}),
    ...(hasFields ? { fields: baseFields } : {}),
    ...(hasDrapes ? { drapes } : {}),
    ...(hasReliefs ? { reliefs } : {}),
    ...(hasShells ? { shells } : {}),
    // parts-booleans B1: the cut is stored AS a cut (the monomers stay in their arrays); the
    // rewrite to a field happens on every render, so an edit to a bore re-cuts
    ...(Array.isArray(cuts) && cuts.length ? { cuts } : {}),
    ...(typeof units === 'string' ? { units } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(typeof facing === 'string' || Number.isFinite(facing) ? { facing } : {}),
    ...(title ? { title } : {}),
  };

  // Lower once to validate the recipe is renderable + return a size/face readout (no geometry stored).
  // For the code kind this is the program's first run: a throw fails the mint with the error AND the
  // captured log (the agent's loop is mint → read → update_sketch).
  const { stats } = planWorkbench(manifest);
  // G6: the ledger travels with the recipe (recipe bytes, faces, closure) — export_model reads it
  // back beside the whole-object audit, so "closed at mint, open after an edit" is legible.
  manifest.ledger = persistedLedger(stats.ledger);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `workbench · ${stats.monomers} monomer${stats.monomers === 1 ? '' : 's'}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  warmScenePng(sketch);   // background pre-bake of the gallery preview PNG

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    stats,
  };
}

/**
 * mint_solid kind 'code' — the code door (expressiveness.plan.md E3). `spec.source` is the body
 * of a function (params, ctx) that RETURNS a workbench spec (monomer arrays / assembly) or a
 * face list; `params` are the dials update_sketch turns; `seed` seeds the realm's Math.random;
 * `budgetMs` is the one limit. Stores a plain `kind:'workbench'` manifest carrying `program`,
 * so every leg (world, scene, skin, export, assembler parts, save_recipe) is inherited.
 */
export async function createCodeSolidHandler(input) {
  if (!input || typeof input !== 'object' || typeof input.source !== 'string') {
    throw new Error("The code kind needs `source` — the body of a function (params, ctx) that returns a workbench spec ({ lathes | extrudes | sweeps | lofts | fields | drapes | reliefs | shells | assembly }) or a face list ([{ corners, fill?, group? }]). Read get_solid_vocab({ id: 'code' }) for the realm API and worked programs.");
  }
  const { title, source, params, seed, budgetMs, units, viewBox, facing, ref, folder_ref: folderRef, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, cuts } = input;
  return mintWorkbench({
    title, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, cuts,
    program: { source, params, seed, budgetMs },
    units, viewBox, facing, ref, folderRef,
  });
}

export async function createWorkbenchHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_workbench requires a recipe object with a `lathes` array');
  }
  const { title, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, assembly, cuts, program, units, viewBox, facing, ref, folder_ref: folderRef } = input;
  return mintWorkbench({ title, lathes, extrudes, sweeps, lofts, fields, drapes, reliefs, shells, assembly, cuts, program, units, viewBox, facing, ref, folderRef });
}

export function registerWorkbenchTools() {
  registerTool({
    name: 'create_workbench',
    description:
      "Mint a measured OBJECT study — the object-scale sibling of create_fractal_city. Where the "
      + "city/hub mints drop you INTO a traversable world at abstract scale, the workbench presents a "
      + "single everyday object on a measured grid at LITERAL real-world scale, for form accuracy "
      + "(neutral studio light, no mood). You build the object as a POLYGOMER — monomer primitives "
      + "bonded by literal placement of their axes. Eight monomer kinds:\n"
      + "• `lathes` — surfaces of REVOLUTION (axisFrom→axisTo + a radius `profile` of {t,radius}, "
      + "optional N-fold `harmonics` for fluting/threads): candlestick, bottle, dumbbell, vase, lamp, "
      + "wheel, plate, spindle.\n"
      + "• `extrudes` — PRISMS from a 2D profile swept along an axis, OR recessed SHELLS when "
      + "`wallThickness` is set: box, slab, bracket, sign (solid) and tray, case, enclosure, drawer, "
      + "bin (shell). Profile is { rect:{w,h,r?} } or { points:[[u,v]…] }.\n"
      + "• `sweeps` — a tube swept ALONG a 3D `path`: handles, frames, hooks, cables, coil springs.\n"
      + "• `lofts` — a profile that CHANGES along its path: ≥2 `stations` ({t, profile, roll?}, one "
      + "shared point count) interpolated ring to ring — a boat hull, a tapering handle, a bottle that "
      + "squares off, a twisted fin. A 2-point path / axisFrom→axisTo is a straight loft.\n"
      + "• `fields` — CUTS, pockets, bores, blended masses and organic detail composed in FIELD "
      + "space and polygonized once: a `terms` list read top-down (`add`/`subtract`/`intersect` a "
      + "shape — sphere/ellipsoid/roundCone/box/capsule or the field twins lathe/extrude/sweep — "
      + "with `blend` for a filleted join; `stroke` dabs in/out; `displace` seeded noise; `shell`; "
      + "`round`; domain ops `transform`/`repeat`/`twist`/`bend`/`taper`/`elongate` over a nested "
      + "`terms` sub-solid). `expr { d, vars?, bounds }` is a distance EXPRESSION over x y z — "
      + "grammar and idioms on the card. `cells` (16–128, default 64) is the resolution dial: cubic cost, edges round to "
      + "about one cell. To cut INTO a lathe, author it as a `fields` term, not a `lathes` entry.\n"
      + "• `reliefs` — a 2D outline (an SVG `path` or font `text`) RAISED off a base along its normal "
      + "into bevelled geometry (additive emboss, never a cut): nameplates/plaques, wordmarks lifted "
      + "off a panel, a seal struck onto a lathe disc. Params in the schema; sink `anchor` ~0.1 into "
      + "the base to avoid coplanar z-fight.\n"
      + "• `shells` — parametric POLYHEDRA (tetrahedron/cube/octahedron/dodecahedron/icosahedron/"
      + "truncated_icosahedron/geodesic) by `solid` + `radius`, optionally with per-face `ops`. The one "
      + "monomer whose identity is its face LAYOUT rather than a swept profile: a geodesic dome, a d20, "
      + "a soccer-ball shell, a faceted housing with inset panels and ports. `ops` run in ORDER — "
      + "inset/extrude/recolor/port — each selecting faces SEMANTICALLY (`{sides:6}`, `{facing:'+z'}`, "
      + "`{ring:'equator'}`, `{group:'inset'}`, `{every:3}`) and tagging what it emits so the next op "
      + "can select it. Surface ops, not booleans: `port` seats a cylinder ON a face, it does not drill "
      + "through. Full vocabulary: get_solid_vocab('workbench').\n"
      + "STACKING (relative composition): for a vertical multi-part object (candlestick, lamp, vase, "
      + "dumbbell, spindle) prefer `assembly` over hand-placed axes — declare each part by `height` + "
      + "`profile` and it auto-stacks on the one below (running z computed for you; `on`/`gap`/`offset` "
      + "to override). It lowers to `lathes`/`extrudes`/`lofts`/`fields` and merges with explicit arrays, so a mug = an "
      + "assembled lathe body + an explicit swept handle. A part can REPLICATE itself at the same "
      + "stacked z: `radial:{count,radius}` rings copies around a circle (round-stool legs, bolt "
      + "circles, candelabra arms) and `mirror:'x'|'y'|'xy'` reflects the offset into corner copies "
      + "(`offset:[a,b],mirror:'xy'` → 4 rectangular table/chair legs) — a part `on` a replicated part "
      + "still seats on its single top. The result `stats.parts[]` reports each part's size + base/top "
      + "z, and `stats.warnings` flags an object floating off the measured grid — read them before "
      + "opening /world.\n"
      + "MATERIALS: any monomer takes `material` — a named finish (gold, chrome, wood, glass, …): "
      + "live metal gleam in /world, real PBR in .glb. Full shelf in the lathes[].material schema.\n"
      + "PACKAGE DESIGN: a lathe or an extrude can carry a `wrap` — a label image (inline svg, a data URL, a "
      + "stored `sketchRef`, or an `outcomeRef` — a generated image-outcome render as the skin) "
      + "mapped around the wall → a labeled can/bottle/cup, or around a prism's side panels → a printed carton/box (shown in /world; PNG sources export as real .glb textures). "
      + "Compose them: a mug = a shell lathe + a swept handle; a labeled can = one lathe + a wrap. "
      + "Fractal-generation path — the substrate stores ONLY the recipe and regenerates the object "
      + "deterministically, served as a traversable three.js World at `/api/sketches/<ref>/world` "
      + "(free orbit) + preset CSS-3D shots at `/scene`; persists with `manifest.kind === 'workbench'`. "
      + "Reach for 'render an object / a mechanical part / an everyday object from primitives / a "
      + "turntable of a <object> / block out a <object> in solids'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        lathes: {
          type: 'array',
          description: 'Revolution monomers (surfaces of revolution), bonded by literal placement of their axes. Each renders a vexar-shaded, capped solid. Provide `lathes` and/or `extrudes` (at least one monomer total).',
          items: {
            type: 'object',
            properties: {
              axisFrom: { type: 'object', description: 'Axis start point {x,y,z} (z is up). The revolution sweeps along axisFrom→axisTo.' },
              axisTo: { type: 'object', description: 'Axis end point {x,y,z}.' },
              profile: {
                type: 'array', minItems: 1,
                description: 'Radius profile along the axis: an array of { t, radius } with t in [0,1] monotonically non-decreasing (t=0 at axisFrom, t=1 at axisTo). Ends at radius→0 self-close; ends with real radius get a flat cap.',
                items: { type: 'object', properties: { t: { type: 'number' }, radius: { type: 'number' } }, required: ['t', 'radius'] },
              },
              tint: { type: 'string', description: "Optional base albedo hex (e.g. '#c79a4b' brass, '#9aa3b0' steel). Vexar Lambert shades it per face." },
              material: { description: "Optional surface FINISH from the material shelf — what the part is MADE OF, not just its colour: gold / steel / chrome / bronze / silver / copper / gunmetal (metals — live specular highlight in /world, real PBR metallic in .glb export) · matte / plaster / stone / wood / rubber / plastic / satin (soft) · glass / neon / cel (stylized). Also accepts a '#hex' (satin-tinted) or { preset, ...overrides }. Composes with `tint` (tint = albedo, material = response). Unknown names are rejected at mint." },
              harmonics: { type: 'array', description: 'Optional N-fold angular harmonics [{ n, amplitude, phase? }] for fluting / chiselling / thread-like ridges.' },
              normalFrom: { type: 'object', description: 'Optional cross-section normal {x,y,z} at t=0 (paired with normalTo) to bend the sweep frame.' },
              normalTo: { type: 'object', description: 'Optional cross-section normal {x,y,z} at t=1.' },
              crossSections: { type: 'integer', description: 'Optional mesh density along the axis (default 24).' },
              samples: { type: 'integer', description: 'Optional mesh density around the axis (default 36).' },
              wrap: {
                type: 'object',
                description: "Optional LABEL WRAP — map a label image around a t-band of the wall (a can/bottle/cup label; a cylinder is a perfect developable surface, so no distortion). Renders in the traversable /world view. { source: { svg:'<svg…>' | dataUrl:'data:…' | sketchRef:'sk_…' (a stored sketch as the label) | outcomeRef:'sk_…' (an image-outcome sketch — its latest bound render PNG becomes the skin; optional target?, default 'page'; mint the art via create_sketch kind:'image-outcome' → the image-worker render seam → bind_image_render) }, band?:{ tFrom, tTo } (0..1 of the axis; default the whole wall), seam?: number (rotate the label so its centre faces front / hide the seam at the back, 0..1) }. PNG sources (dataUrl PNG / outcomeRef) also export as real textures in .glb; svg sources render in /world only. Tip: a full-wrap label whose art includes the metal top/bottom reads like a real can.",
              },
            },
            required: ['axisFrom', 'axisTo', 'profile'],
          },
        },
        extrudes: {
          type: 'array',
          description: 'Extrusion monomers: a 2D profile swept along an axis into a solid prism, or a recessed SHELL when `wallThickness` is set. Boxes, slabs, brackets (solid); trays, cases, enclosures (shell).',
          items: {
            type: 'object',
            properties: {
              profile: { type: 'object', description: 'The 2D cross-section: { rect: { w, h, r? } } (rounded rectangle — the common case) OR { points: [[u,v], …] } (a closed polygon, e.g. an L-bracket or hex). r is the corner radius.' },
              axisFrom: { type: 'object', description: 'Extrusion start point {x,y,z} (z up). The profile lies in the plane ⟂ to axisFrom→axisTo and sweeps to axisTo.' },
              axisTo: { type: 'object', description: 'Extrusion end point {x,y,z} (axis length = the depth/height).' },
              endProfile: { type: 'object', description: 'Optional linear TAPER: a second { points:[[u,v],…] } ring (SAME point count as profile) at the axisTo end — the cross-section lerps along the axis into wedges, pyramidal frusta, tapered fins/keels. Repeat a vertex to pinch a face; a zero-area end ring drops its cap. Points profiles only; cannot combine with wallThickness.' },
              wallThickness: { type: 'number', description: 'Optional — omit for a SOLID prism; set it to hollow the prism into a recessed SHELL (tray/case/enclosure) with walls this thick. Rect profiles only (v1).' },
              floorThickness: { type: 'number', description: 'Shell only: thickness of the closed back/floor (default = wallThickness).' },
              openFace: { type: 'string', enum: ['to', 'from', 'none'], description: "Shell only: which end is open — 'to' (the axisTo end, default), 'from', or 'none'." },
              tint: { type: 'string', description: 'Optional base albedo hex.' },
              material: { description: "Optional surface finish from the material shelf (same vocabulary as lathes[].material): a named row (gold/steel/chrome/…/wood/stone/glass), a '#hex', or { preset, ...overrides }." },
              innerTint: { type: 'string', description: 'Optional shell cavity albedo (default = tint; a darker value reads more sunken).' },
              cornerSamples: { type: 'integer', description: 'Optional rounded-corner resolution (default 6).' },
              wrap: {
                type: 'object',
                description: "Optional PRINT WRAP — the lathe's label contract on a prism (a carton, a box label, a signboard): { source: { svg | dataUrl | sketchRef | outcomeRef }, seam?: number (0..1, rotate the print around the perimeter), repeat?: { u, v }, lit?: boolean }. u runs along the profile's perimeter in its winding order (a rect, rounded or not: the +u side first, then the +v front, the −u side, the −v back — each panel takes its edge's share of the width; a points profile starts at its first point), v runs along the axis 0→1; no band — the print covers the whole wall. Side walls only (the outer walls of a shell); caps and cavities stay bare. Lay a carton's wrap as [side | front | side | back] at the panels' true proportions.",
              },
            },
            required: ['profile', 'axisFrom', 'axisTo'],
          },
        },
        lofts: {
          type: 'array',
          description: "Loft monomers: a profile that CHANGES along its path — the N-station generalisation of an extrude's `endProfile` taper and a sweep's tube. Each: `{ path:[[x,y,z],…] | axisFrom+axisTo, stations:[{ t:0..1, profile:[[u,v],…] | { radius, sides? }, roll?: deg }, …] (≥2), interp?: 'linear'|'smooth', segments?, caps?, tint?, material? }`. Every station shares ONE point count (a round station's `sides` counts; default 16) — the validator names the offending station. A 2-point path (or axisFrom/axisTo) is a straight axis using the extrude frame; a longer path bends with rotation-minimizing frames (the path points are the rings — put a path point where a station must land). `interp:'smooth'` runs a spline through the stations (subdivided `segments` per gap on a straight axis, default 6). Use for a boat hull (keel → midship → transom), a tapering handle, a bottle that squares off, an airfoil that twists.",
          items: { type: 'object' },
        },
        fields: {
          type: 'array',
          description: "Field-solid monomers: composition in FIELD SPACE, polygonized once — the native answer for a hole, a pocket, a bore, a blended mass, a bump or a dent. Each: `{ terms:[…], cells?: 16..128, translate?: [x,y,z], tint?, material? }`. `terms` is read TOP-DOWN and is a description of the object: `{ id?, op:'add'|'subtract'|'intersect', shape:{ kind, … }, blend? }` (blend>0 = the smooth variant), `{ op:'stroke', at, radius, strength, blend? }` (strength>0 adds a dab, <0 carves one), `{ op:'displace', noise:{ amplitude, scale?, octaves?, persistence?, seed? } }`, `{ op:'shell', thickness }`, `{ op:'round', radius }`. The first term must be `add`. Shape kinds: `sphere {center,radius}` · `ellipsoid {center,radii}` · `roundCone {a,b,ra,rb}` · `box {center,size,round?}` · `capsule {a,b,radius}` · `lathe {profile,axisFrom,axisTo,harmonics?}` · `extrude {profile,axisFrom,axisTo}` · `sweep {path,radius}` (the last three are the field twins of the face-list monomers — to cut INTO a lathe, author it here, not in `lathes`). Every face is tagged `group:<term id>` (nearest term), so ops/selectors can address a bore by name. Edges round to about one grid cell (`cells`, default 64; cost is cubic — 96–128 for a hero render or export); a sharp machined edge is `export_model union:true` (Manifold) or the DCC. Closed by construction. Full vocabulary: get_solid_vocab('workbench').",
          items: { type: 'object' },
        },
        sweeps: {
          type: 'array',
          description: 'Sweep monomers: a circular tube swept along a 3D path (rotation-minimizing frames → no twist). Handles, frames, hooks, cables, coil springs.',
          items: {
            type: 'object',
            properties: {
              path: { type: 'array', description: 'The centreline: an array of >= 2 [x,y,z] points the tube follows (a C-curve for a handle, a helix for a spring, etc.). z is up.', items: { type: 'array', items: { type: 'number' } } },
              radius: { type: 'number', description: 'Tube radius.' },
              sides: { type: 'integer', description: 'Optional cross-section resolution around the tube (default 16; >= 3).' },
              tint: { type: 'string', description: 'Optional base albedo hex.' },
              material: { description: "Optional surface finish from the material shelf (same vocabulary as lathes[].material) — a chrome towel-rail or copper pipe is a sweep + a metal material." },
              caps: { type: 'boolean', description: 'Optional — close the two ends (default true). Set false when both ends embed in another monomer (e.g. a handle into a mug wall).' },
            },
            required: ['path', 'radius'],
          },
        },
        drapes: {
          type: 'array',
          description: "Drape monomers: a hanging cloth SHEET — cape, robe, cloak, tabard, shroud, banner, or covering. UNLIKE lathes/extrudes/sweeps (solid parts), a drape is an OPEN two-sided sheet with real folds, sag, and a pin→free billow — so STOP faking cloth with thin flat extrudes (they collapse to slivers off-axis). A drape is the wave-field specialized into cloth: a top edge pinned to two anchor points, hem flared + dropped, folds that grow from 0 at the pinned edge to full at the free hem. Same body-agnostic kernel the human wardrobe uses, so it drapes over ANY part of the object. Each entry: `{ anchor, hang?, back?, drop?, flare?, hemZ?, spread?, waves?, pinToFree?, samples?, tint?, material? }`. `anchor` (required) is EXACTLY TWO points ([x,y,z] or {x,y,z}) — the pinned top edge (e.g. the two shoulder points for a cape). `hang` is 'back' (default) or 'front'. `back` = standoff off the object (default 1); `drop` = how far the hem swings past `back` (default 3); `flare` widens the hem about its midpoint (default 1.32); `hemZ` = absolute hem height (default = anchor-height × 0.16 — set it to the ground for a floor-length robe); `spread` widens the top edge (default 1; >1 fans a narrow edge into a wide cape). `waves` = rest folds (default vertical pleats); `pinToFree` (default true) keeps the pinned edge still while the hem billows. `tint`/`material` shade it like any monomer.",
          items: {
            type: 'object',
            properties: {
              anchor: { type: 'array', description: 'Exactly two pinned top-edge points ([x,y,z] or {x,y,z}).' },
              hang: { type: 'string', description: "'back' (default) or 'front'." },
              back: { type: 'number' }, drop: { type: 'number' }, flare: { type: 'number' },
              hemZ: { type: 'number' }, spread: { type: 'number' }, pinToFree: { type: 'boolean' },
              tint: { type: 'string', description: 'Optional base albedo hex.' },
              material: { description: 'Optional surface finish from the material shelf (satin, velvet, etc.).' },
            },
            required: ['anchor'],
          },
        },
        reliefs: {
          type: 'array',
          description: 'Relief monomers: a 2D outline (SVG path or font text) raised off a base plane along its normal into bevelled geometry — an ADDITIVE emboss, never a subtractive cut. Embossed nameplates/plaques, wordmarks/logos lifted off a panel, a seal/star struck onto a lathe disc (coin/medallion). Geometry only (no metal/glow/fx). Tip: sink `anchor` slightly into the base so the buried back face does not z-fight the base top.',
          items: {
            type: 'object',
            properties: {
              shape: { type: 'object', description: "The outline source: { path: '<svg d>' } (a logo/icon/symbol) OR { text: '…', font?: '<path-to-ttf>' } (font-carved letters; counters become real holes)." },
              size: { type: 'number', description: 'Literal size the normalized outline maps to, in the manifest units (cap-height for text; largest dimension for a path). depth/bevel scale with it, so proportions hold.' },
              anchor: { type: 'object', description: 'Where the outline plane sits {x,y,z} — the surface the relief rises from. Sink it ~0.1 below a base top so the buried back cap does not coincide with (z-fight) the base.' },
              normal: { type: 'object', description: 'Optional raise direction {x,y,z} (default {x:0,y:0,z:1} — lay flat, rise up). Point it at a lathe wall/cap surface-normal to emboss onto a turned form.' },
              up: { type: 'object', description: 'Optional in-plane orientation {x,y,z} of the glyph vertical (default {x:0,y:1,z:0}).' },
              style: { type: 'object', description: 'Optional geometry style: { depth, bevel, bevelSteps, weight, blocky, slant, tracking, curveSteps } — same vocabulary as the carved-solid kernel (depth/bevel are in normalized outline units, scaled by `size`).' },
              tint: { type: 'string', description: 'Optional base albedo hex (vexar Lambert shades it per face).' },
              material: { description: "Optional surface finish from the material shelf (same vocabulary as lathes[].material) — a bronze plaque or gold seal is a relief + a metal material." },
            },
            required: ['shape', 'anchor'],
          },
        },
        shells: {
          type: 'array',
          description: "Shell monomers: parametric POLYHEDRA. Each: `{ solid, radius, center?, orient?, frequency?, tint?, material?, group?, open?, ops? }`. `solid` (required) is one of tetrahedron | cube | octahedron | dodecahedron | icosahedron | truncated_icosahedron (soccer ball: 12 pentagons + 20 hexagons) | geodesic. `radius` (required) is the CIRCUMradius — the distance to a VERTEX, so the bounding box is SMALLER than 2×radius (an icosahedron spans 1.70×radius); seat it on the grid by its bbox, not by center.z=radius. `center` {x,y,z} places it (z up); `orient` [rx,ry,rz] degrees turns it; `frequency` (geodesic only, 1-8, default 1) sets subdivision — 20×frequency² faces, keep ≤4 for a live world. `group` (default 'shell') tags its faces. `open` is a face SELECTOR whose faces are cut away (a dome = a shell minus its lower band). `ops` is an ordered list of per-face operations: `{op:'inset', select, by|ratio}` (a smaller panel + a rim ring), `{op:'extrude', select, by}` (push the face along its normal, negative recesses), `{op:'recolor', select, tint?|material?|group?}`, `{op:'port', select, radius, depth, sides?}` (seat a cylinder on the face center — ADDITIVE, not a drilled hole). Every `select` is semantic — `{facing:'+z',within:30}` / `{ring:'equator',band:0.2}` / `{sides:5}` / `{group:'panel'}` / `{near:[0,0,1],count:1}` / `{every:3}` / `{not:…}` / `{and:…}` — never a hand-numbered index. A selector matching nothing is refused at mint. Prefer `{near,count}` over a `facing` cone when you mean 'the top one'.",
          items: { type: 'object' },
        },
        assembly: {
          type: 'object',
          description: "RELATIVE COMPOSITION — declare a vertical multi-part object by size + connection instead of absolute axes. The running z is computed for you so each part seats flush on the one below (no hand-stacked `axisFrom`/`axisTo`). Lowers to `lathes`/`extrudes` and merges with any explicit arrays. Use for candlestick/lamp/vase/dumbbell/spindle; keep `sweeps` (handles, springs) in the explicit array.",
          properties: {
            parts: {
              type: 'array', minItems: 1,
              description: 'Ordered parts, stacked bottom→top. Each: { kind:"lathe"|"extrude"|"loft"|"field", height (axis length along z, >0), profile (lathe: [{t,radius}]; extrude: {rect|points}) or stations (loft: [{t,profile,roll?}], straight up the stack axis) or terms (field: authored with z from 0 up to height; the stack translates it), id? (name for `on`), on? ("ground" | an earlier part id/index; default = the previous part), gap? (lift above the support, default 0), offset? ([dx,dy] off the stack axis, default [0,0]), radial? ({ count, radius, startAngle?, center? } — ring N copies around a circle), mirror? ("x"|"y"|"xy" — reflect the offset into 2/4 corner copies; e.g. offset:[a,b],mirror:"xy" = 4 legs), + any monomer passthrough (tint, material, harmonics, wrap, wallThickness, openFace, …). Use radial OR mirror, not both.',
              items: { type: 'object' },
            },
          },
          required: ['parts'],
        },
        units: { type: 'string', description: "Informational unit label for the world coordinates (e.g. 'cm', 'mm', 'in') — surfaced in the size readout and grid (1 grid cell = 5 units). Default 'cm'." },
        viewBox: { type: 'object', description: 'Optional render viewBox { width, height } (default 900×900).' },
        facing: { type: ['string', 'number'], description: "Which way the model's FRONT points, so the preset 'front' shot (and the /png + /scene + /world opening camera) looks it in the face: '+y' (default — the studio camera convention), '-y', '+x', '-x', or a raw azimuth offset in degrees. Camera-only; geometry is untouched." },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createWorkbenchHandler,
  });
}
