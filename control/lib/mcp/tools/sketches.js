/**
 * create_sketch — operator agent mints a flow-charty diagram on demand.
 *
 * The agent POSTs a manifest (same shape the curated app-creation map at
 * /graph uses); we persist it and return a `/sketches/<ref>` URL the agent
 * hands to the user. Renders via the existing CreationMap.jsx SVG layer —
 * no new renderer, no library deps.
 *
 * Deliberately NOT integrated into forward_context / Ring 6 / contextmap.
 * Sketches are scratch visualizations, not structural decisions. If the
 * surface earns its place later we promote it; until then, the agent
 * discovers it via the protocol-level tools/list response.
 *
 * See lite-template/integration/app-system/0527/SKETCHBOOK_PLAN.md.
 */


// PHASE 1c (mojulo-2.0-pure-creative.plan.md): this file used to be 2038 lines
// hosting six unrelated tool families. The handlers now live in focused siblings
// — sketch-mint / sketch-vocab / sketch-diff-tool / sketch-polygonizer /
// sketch-model-export / sketch-image-render — and what remains here is the
// REGISTRATION SURFACE: the tool schemas and their wiring, which is one coherent
// concern (this is the agent-facing contract for the whole sketch family).
//
// Every symbol the six modules export is re-exported below, so the ~20 existing
// importers of this path keep working unchanged. New code should import from the
// specific sibling rather than from this barrel.

import { registerTool } from '@/lib/mcp/server';
import { withPluginProfile } from '@/lib/mcp/plugin-profile';

import {
  PRELOAD_MAX_ITEMS,
  resolvePreloads,
  resolvePreloadSketch,
  resolveCharacterRefs,
  mintSketch,
  createSketchHandler,
  updateSketchHandler,
} from './sketch-mint.js';
import { getSketchVocabHandler, getStyleVocabHandler } from './sketch-vocab.js';
import { diffSketchesHandler } from './sketch-diff-tool.js';
import {
  createPolygonizedSketchHandler,
  getPolygonizerPacketHandler,
  submitPolygonizerManifestHandler,
  getSkinPacketHandler,
  skinPolygomerHandler,
  POLYGONIZER_PRELOAD_SCHEMA,
} from './sketch-polygonizer.js';
import { exportModelHandler, bindMeshRenderHandler } from './sketch-model-export.js';
import {
  getImageRenderPacketHandler,
  bindCharacterSheetHandler,
  bindImageRenderHandler,
} from './sketch-image-render.js';

// exportsBaseDir lives in ./exports-dir.js (shared with tools/beats.js);
// re-exported here for existing importers.
export { exportsBaseDir } from './exports-dir.js';

export {
  PRELOAD_MAX_ITEMS,
  resolvePreloads,
  resolvePreloadSketch,
  resolveCharacterRefs,
  mintSketch,
  createSketchHandler,
  updateSketchHandler,
  getSketchVocabHandler,
  getStyleVocabHandler,
  diffSketchesHandler,
  createPolygonizedSketchHandler,
  getPolygonizerPacketHandler,
  submitPolygonizerManifestHandler,
  getSkinPacketHandler,
  skinPolygomerHandler,
  exportModelHandler,
  bindMeshRenderHandler,
  getImageRenderPacketHandler,
  bindCharacterSheetHandler,
  bindImageRenderHandler,
};

// The Claude plugin profile leaves out the painted manifest kinds (lib/mcp/plugin-profile.js).
const PAINTED_KINDS_CLAUSE = ', painted `image-outcome` / `sequential-art` / `character-sheet` / `keyframe-animation` / `scene-motion`';

export function registerSketchTools() {
  registerTool(withPluginProfile({
    name: 'create_sketch',
    description:
      "Mint a sketch → `{ ok, ref, url }` (hand the URL off via the host). `manifest.kind`: `store` / `mall` / `restaurant`, `historic`" +
      PAINTED_KINDS_CLAUSE +
      ". `manifest.recipe`: a scene/figure illustration family (knobs via sketch_what_possible). Else hand-built `marks[]` / `stations[]` + `edges[]`; a plain flow or data chart is lighter via mint_diagram; a house is mint_building. Also restores an exported world recipe. Read the card first: get_sketch_vocab({ id }) or semantic_search({ kinds: ['sketch_vocab'] }). Iterate with update_sketch.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title shown in the page header.' },
        manifest: {
          type: 'object',
          additionalProperties: true,
          description:
            "The recipe. Diagrams take title + viewBox { width, height } and stations[] / marks[] (cards: mark-primitives, construction-marks, edge-notation, grid-layout). A kind or a recipe takes its card's shape instead.",
        },
        ref: {
          type: 'string',
          description: 'Optional stable ref (1-64 chars of [A-Za-z0-9_-]); default `sk_<10-char>`. Errors if taken.',
        },
        folder_ref: { type: 'string', description: 'Optional `fld_<…>` folder to drop the sketch into.' },
        preload: {
          description: 'Optional prior `sk_…` ref, or up to ' + PRELOAD_MAX_ITEMS + ' `{ ref, as?, note? }`, this sketch composes against. Echoed back, not blended.',
        },
      },
      required: ['title', 'manifest'],
    },
    handler: createSketchHandler,
  }, {
    edits: [[PAINTED_KINDS_CLAUSE, '']],
  }));

  registerTool(withPluginProfile({
    name: 'update_sketch',
    description:
      "Revise an existing sketch in place — rename it, patch or replace its manifest — same ref. The ITERATE surface for every sketch-stored recipe: diagrams, worlds, solids/figures, edifices, views, image-outcomes, kind:'game'. Each kind pays its own gate (diagrams as `create_sketch`; world/solid kinds resolve through the world registry; games create_game's structural gate, new levels unaudited). Beats/voice refuse and point at their domain tools. Prefer `patch` (set/remove/add ops by monomer `id` or JSON Pointer `path`; `readout:'changed'` returns only what moved) over a FULL `manifest` replace. Layered: `strokes` + op 'solve' (get_solid_vocab layered). Re-mint only for a side-by-side variant.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Existing sketch ref to update. Errors if no sketch with this ref exists.',
        },
        title: {
          type: 'string',
          description: 'New title. Omit to leave the title unchanged.',
        },
        manifest: {
          type: 'object',
          description:
            'Full replacement manifest (same shape as create_sketch). Omit to leave the manifest unchanged. When provided it overwrites the previous manifest whole — for a targeted edit send `patch` instead (exclusive with `manifest`).',
        },
        patch: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              op: { type: 'string', enum: ['set', 'remove', 'add', 'solve'] },
              id: { type: 'string', description: 'Monomer id to address (set / remove).' },
              from: { type: 'string', description: "Stroke to solve, '/strokes/<id>' (layered rows; solve ops come last)." },
              path: { type: 'string', description: "JSON Pointer to address (set / remove), e.g. '/movers/0/states'." },
              value: { description: 'The replacement value (set by path).' },
              into: { type: 'string', enum: ['lathes', 'extrudes', 'sweeps', 'lofts', 'fields', 'drapes', 'reliefs', 'shells'], description: 'Monomer array to append to (add).' },
              entry: { type: 'object', description: 'The monomer to append (add).' },
            },
            required: ['op'],
          },
          description:
            "Ordered ops applied to the STORED manifest, then gated exactly like a `manifest` replacement (exclusive with it). `{ op:'set', id, ...keys }` shallow-merges keys into the monomer with that `id` (a key set to null deletes it); `{ op:'set', path, value }` replaces the value at a JSON Pointer (the last segment is created if absent); `{ op:'remove', id | path }`; `{ op:'add', into, entry }`. Ids resolve across every monomer array (an ambiguous id is refused); unnamed monomers are reachable by `path` only. Removing a monomer a `cuts` or `movers` entry still names is refused. The stored row is the resolved manifest; the ops ride the archived revision as its diff.",
        },
        readout: {
          type: 'string',
          enum: ['changed', 'summary', 'full'],
          description:
            "Shape of `stats` on a workbench edit: 'changed' (default with `patch`) — only the parts the patch touched or whose bounds / closure moved, `removed` parts, and NEW warnings (ones already on the previous revision collapse to one counted line); 'summary' — counts, size, ledger, warnings, no parts; 'full' (default with `manifest`) — the whole readout.",
        },
        folder_ref: {
          type: 'string',
          description:
            'Optional folder ref to move the sketch into. Pass an empty string or null to move it back to root. Omit to leave the folder unchanged.',
        },
        note: { type: 'string', description: 'Revision note (solid kinds keep history).' },
        bucket: {
          type: 'string',
          enum: ['diagram', 'illustration'],
          description:
            "Optional concern override — pin this sketch into 'diagram' (Sketches) or 'illustration' (Maker). Pass null to drop back to the kind-derived bucket. Omit to leave it unchanged. Reclassifying is purely a concern move; the sketch is the same primitive either way.",
        },
      },
      required: ['ref'],
    },
    handler: updateSketchHandler,
  }, {
    edits: [
      [", edifices, views, image-outcomes, kind:'game'.", ", edifices, views, kind:'game'."],
      ['Beats/voice refuse and point at their domain tools.', 'Beats refuse and point at their domain tools.'],
    ],
  }));

  registerTool({
    name: 'get_sketch_vocab',
    description:
      "Read a sketch-vocabulary card in full — the layout math + example marks for one chart paradigm or layout affordance (e.g. `donut-ring`, `stacked-bar`, `stat-tile`, `grid-layout`, `z-layering`, `pipeline`). Pair with `semantic_search({ kinds: ['sketch_vocab'] })`: that returns ranked `source_ref`s for an intent; this resolves a ref to the full card so you can compose `create_sketch` marks from real layout discipline rather than guessing. Call with no `id` (or `id` omitted) to list the available cards. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'The card id (a sketch_vocab source_ref from semantic_search). Omit to list all available cards with their summaries.',
        },
      },
    },
    handler: getSketchVocabHandler,
  });

  registerTool({
    name: 'get_style_vocab',
    description:
      "Read the STYLE presets — drawing-discipline templates (steamboat, tv-cartoon, louvrijks oil, ukiyo-e, photo-realism/'unreal-engine', …) plus clay-render (untextured grey model — the dream-loop default) that `renderBrief` locks on image / keyframe-animation / scene-motion sketches. Omit `id` to LIST; pass a preset to read it in full (Style Lock lines + dial specs). Presets are TEMPLATES: fork via `renderBrief.overrides`, or author a fully custom style inline (`{ id, style, mood, lighting, lock[], negative[] }`). Applying the SAME style to a scene's cast clips and its plate is what makes it cohesive. Read-only.",
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'A style preset name (e.g. steamboat, ukiyo-e, photo-realism). Omit to list all presets + how to author a custom style.',
        },
      },
    },
    handler: getStyleVocabHandler,
  });

  registerTool({
    name: 'diff_sketches',
    description:
      "Create a scratch visual diff between two existing sketch refs. Use this only when two diagrams look like variants of the same thing and a visual comparison would help the operator; it is intentionally optional and low-prominence like create_sketch. The tool reads both manifests, matches stations/marks structurally, highlights differences in a derived side-by-side sketch, persists that derived sketch, and returns `{ ok, ref, url, verdict, similarity, summary }`. Highlight vocabulary: green = added in `right_ref`, red = removed from `left_ref`, amber = changed labels/items/kinds/marks, blue = moved/resized, grey/muted = context. If the sketches are probably unrelated, the tool returns `{ ok:false, verdict:'too_different', similarity, summary }` and does not mint unless `force:true` is passed. Read/write only to the scratch sketchbook; does not commit to contextmap.",
    inputSchema: {
      type: 'object',
      properties: {
        left_ref: {
          type: 'string',
          description: 'Existing sketch ref to treat as the before/left side.',
        },
        right_ref: {
          type: 'string',
          description: 'Existing sketch ref to treat as the after/right side.',
        },
        title: {
          type: 'string',
          description: 'Optional title for the derived diff sketch.',
        },
        ref: {
          type: 'string',
          description:
            'Optional stable ref for the derived diff sketch (1-64 chars of [A-Za-z0-9_-]). If omitted, a `sk_<10-char>` ref is generated.',
        },
        min_similarity: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.25,
          description:
            'Minimum manifest similarity required before minting. Defaults to 0.25; lower only when you expect noisy generated sketches.',
        },
        force: {
          type: 'boolean',
          default: false,
          description:
            'Mint even when similarity is below min_similarity. The response verdict becomes forced_low_confidence.',
        },
      },
      required: ['left_ref', 'right_ref'],
    },
    handler: diffSketchesHandler,
  });

  registerTool({
    name: 'get_image_render_packet',
    description:
      "Pull the render packet for a minted `image-outcome` / `sequential-art` sketch — the handoff for an external image-capable render worker. Returns `{ ref, kind, renderStrategy?, target, targets, workerProtocol, instructions, localParams, scaffold: { svgUrl, pngUrl }, pageScaffold?, manifest }`. The instructions are the full worker brief: camera/pose phrasings, Style Lock (`renderBrief.preset`), art-layer-only rule. Call once per target: `target: '<panel id>'` yields panel-scoped instructions + `?panel=` scaffold crops. Follow `workerProtocol`: INVOKE your image generator conditioned on the scaffold PNG — the wireframe scaffold is input, NEVER the deliverable. Read-only; return the PNG to the operator.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Existing image-outcome / sequential-art sketch ref (`sk_…`). Errors on other kinds.',
        },
        target: {
          type: 'string',
          description:
            "Render target: `'page'` or a panel id from `targets`. Omit to get the default target (`'page'` for image-outcome/whole-page; the first panel for per-panel) plus the full `targets` list to iterate.",
        },
      },
      required: ['ref'],
    },
    handler: getImageRenderPacketHandler,
  });

  registerTool({
    name: 'bind_image_render',
    description:
      "Bind a worker-generated PNG to one render target of an `image-outcome` / `sequential-art` sketch — the submit half of the render loop. Pass the `target` from `get_image_render_packet` (`'page'`, or a panel id under per-panel/hybrid) plus `image_path` (same-host file) or `image_base64`. Snapshotted append-only into `data/outcomes/<ref>/`. Returns `{ ok, ref, target, n, remaining_targets, final_url? }` — once every target is bound, mojulo composites the finished page at `/api/sketches/<ref>/final.png` (panel renders fitted into bounds, borders/gutters/bubbles/LETTERING re-imposed deterministically), and that final is what gather + cook publish as a comic page in any format.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'The image-outcome / sequential-art sketch ref (`sk_…`). Character sheets use bind_character_sheet.',
        },
        target: {
          type: 'string',
          description: "Render target this PNG fulfils: `'page'` or a panel id. Optional when the sketch has a single target.",
        },
        image_path: {
          type: 'string',
          description: 'Absolute path to the generated PNG on this host (primary for same-host workers).',
        },
        image_base64: {
          type: 'string',
          description: 'Base64-encoded PNG bytes (remote-worker fallback). Exactly one of image_path | image_base64.',
        },
      },
      required: ['ref'],
    },
    handler: bindImageRenderHandler,
  });

  registerTool({
    name: 'bind_character_sheet',
    description:
      "Bind a generated character-sheet PNG to its `character-sheet` sketch — the save half of the reusable-character loop. After the render worker generates the sheet (pulled via `get_image_render_packet` on the sheet's ref), submit the PNG here with `image_path` (same-host file) or `image_base64`. The PNG is snapshotted append-only into the sketch's outcome folder (`data/outcomes/<ref>/sheet-<n>.png`); the latest binding is served at `/api/sketches/<ref>/sheet.png` and rides along as `boundSheet` in every render packet for a comic that casts this character (`characters: [{ ref }]`), so identity persists across artifacts without regeneration. Returns `{ ok, ref, n, path, url, bytes }`.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'The character-sheet sketch ref (`sk_…`) the render belongs to. Errors on other kinds.',
        },
        image_path: {
          type: 'string',
          description: 'Absolute path to the generated sheet PNG on this host (primary for same-host workers).',
        },
        image_base64: {
          type: 'string',
          description: 'Base64-encoded PNG bytes (fallback for remote/foreign workers). Exactly one of image_path | image_base64.',
        },
      },
      required: ['ref'],
    },
    handler: bindCharacterSheetHandler,
  });

  registerTool(withPluginProfile({
    name: 'export_model',
    description:
      "Export a stored sketch's traversable 3D World as a binary glTF (.glb) the operator can open in Blender, Unreal, three.js, or macOS Quick Look. Pass the sketch `ref`. Works for the World kinds (cities, hubs, rooms, terrain, workbench/assembler studies, `manji-tree` polygomers, vehicles, science views, posed figures, carved wordmarks, turntable solids); flat diagrams and charts have no exportable geometry and return `{ ok:false, eligible:false }` with pointers to /scene and /svg. Fidelity: mojulo's lighting is BAKED into the geometry and the mesh is exported UNLIT (glTF KHR_materials_unlit + per-vertex colours), so it looks identical to the live World from any camera, with no lighting setup downstream. Camera-facing glow billboards and the sky dome are dropped (not geometry); gradient-painted faces collapse to a single colour; animated channels export at their static pose. `format: 'stl'` is the 3D-PRINTING handoff: a binary STL for slicers — shape only (colour/textures dropped; water/decals/studio grid omitted; repeats expanded; z-up). Sizing: literal kinds (workbench/assembler/carved-solid/turntable/vehicle) derive mm from `units`; worlds, views, and figures print as MINIATURES fit to `target_mm` (default 120). Honest triangle soup, not guaranteed-manifold — results report an advisory `closure` audit + printed size. Returns `{ ok, ref, kind, format, url, bytes, vertices, triangles }` (+ `nodes` for glb), plus an on-disk `path` when `write` is true (the default). The `url` (`/api/sketches/<ref>/model.glb` or `.stl`) regenerates deterministically on each request — hand it to the operator to download. Rig worlds: pass `clips` (names array or '_all') to bake figure/unit/vehicle rig clips into glTF animations (1s per cycle). `format: 'html'` writes `world.html`, the live page, self-contained (opens from file://, contacts no server); `cdn: true` writes `world.cdn.html` with three.js off the pinned jsdelivr CDN, the form a page door running a CSP executes. `format: 'bundle'` zips page + mesh (+ STL for literal kinds) + recipe + README into `<ref>.zip`, the one file every host's handoff door accepts. Every written result carries `handoff` (this host's next move: artifact, PR, file card, or the dashboard) and `fits` (against the host's byte limit).",
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Existing sketch ref (`sk_…`) to export. Errors if no sketch with this ref exists.',
        },
        clips: {
          anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string', enum: ['_all'] }],
          description: "glb only: rig-clip names to bake as glTF animations, or '_all'. Omit for the static export.",
        },
        skinned: {
          type: 'boolean',
          default: false,
          description: 'With `clips`: each rig figure as ONE SkinnedMesh (JOINTS_0/WEIGHTS_0 + skins/IBM, soft weights where bones carry segments) so the engine deforms smooth flesh. Off: rigid part nodes.',
        },
        humanoid: {
          type: 'boolean',
          default: false,
          description: 'With `skinned`: VRM 1.0 bone names + VRMC_vrm extension (biped rigs).',
        },
        rest: {
          type: 'string',
          enum: ['authored', 'tpose'],
          default: 'authored',
          description: "With `humanoid`: 'tpose' re-rests each figure in the VRM T-pose engines retarget from; clips play unchanged.",
        },
        union: {
          type: 'boolean',
          default: false,
          description: 'stl/3mf only: Manifold CSG union of the shells into ONE solid with a measured volume (optional dep; absent ⇒ ships plain, says why).',
        },
        quantize: {
          type: 'boolean',
          default: false,
          description: 'glb only: KHR_mesh_quantization — smaller file; off = float export.',
        },
        lit: {
          type: 'boolean',
          default: false,
          description: "glb only: the LIT handoff — real pbrMetallicRoughness materials (no unlit extension) over the UNSHADED payload, so Blender / Godot / Unity / Unreal (with the pack's M_MojuloLit master) light the geometry themselves. Off = the mojulo look (unlit vertex colour, light baked in). The web runtime is unaffected.",
        },
        format: {
          type: 'string',
          enum: ['glb', 'stl', '3mf', 'usda', 'usdz', 'scad', 'html', 'bundle', 'ifc', 'blender', 'dxf', 'svg', 'bom'],
          default: 'glb',
          description:
            "'glb' (default): vertex colours, group nodes, unlit. 'stl': print triangles, no colour, mm assumed. '3mf': slicer-preferred print package — mm declared in-file, colours, repeats as instanced objects. 'usda'/'usdz': OpenUSD (DCCs, AR Quick Look) at true scale; usdz = one file. 'scad': an OpenSCAD PROGRAM, not a mesh — a scad row's own source verbatim; a workbench recipe transpiled term by term into OpenSCAD solids and booleans, and a term with no equivalent bakes to polyhedron() and the result's coverage ledger names it. 'bundle': one deterministic zip of world.html + model.glb (+ model.stl for literal kinds) + recipe.json + README.md. 'ifc': a house (floorplan with storeys) as an IFC4 building model for BIM tools. 'blender': a Blender pack (import + art-pass scripts); a world with `fire` carries it at `fire_t` for a Cycles still. 'dxf'/'svg': a scad row as a flat drawing for a laser or CNC (a 2D program as written, a `slice_z` cut, or the outline). 'bom': a fabricated or furniture row's bill of materials, bom.csv + bom.md.",
        },
        slice_z: { type: 'number', description: 'dxf/svg only: cut the scad solid at this height; omit for a 2D program as written, else the outline.' },
        part: { type: 'string', description: "dxf/svg only: which of the scad row's `parts` to draw." },
        fire_t: { type: 'number', description: "blender only: the instant (s) of a world's `fire` to pack; omit for when it reads best." },
        fire_detail: { type: 'number', description: 'blender only: finer flame voxels (1 default, 2 for a close shot).' },
        cdn: {
          type: 'boolean',
          default: false,
          description: "html only. Default false: `world.html` carries three.js inline, opens from file:// and contacts no server. `true` writes `world.cdn.html`, loading three.js from the pinned jsdelivr CDN (~1 MB smaller): the only form an artifact host's CSP runs, since it refuses inline `data:` scripts at ANY size.",
        },
        scale: {
          type: 'number',
          description:
            "STL / 3MF only: world-units → mm multiplier; overrides derivation (literal kinds derive from `units`; others fit to `target_mm`).",
        },
        target_mm: {
          type: 'number',
          description:
            'STL / 3MF only: fit the longest printed dimension to this many mm (non-literal kinds default to 120). Overrides `units` derivation; `scale` beats both.',
        },
        write: {
          type: 'boolean',
          default: true,
          description:
            'When true (default), write the export into data/outcomes/<ref>/ (beside recipe.json + a provenance README) and return its `path`. False: metadata + download URL only.',
        },
      },
      required: ['ref'],
    },
    handler: exportModelHandler,
  }, {
    // The Claude plugin profile writes only the self-contained page (lib/mcp/plugin-profile.js).
    edits: [["; `cdn: true` writes `world.cdn.html` with three.js off the pinned jsdelivr CDN, the form a page door running a CSP executes.", '.']],
    schema: (schema) => {
      delete schema.properties.cdn;
      return schema;
    },
  }));

  registerTool({
    name: 'bind_mesh_render',
    description:
      'Bind an external `.glb` (a Blender pass over an `export_model` export, or a CAD tool\'s tessellation) onto its sketch as an append-only DERIVED artifact: GLB-validated at the door, snapshotted to `data/outcomes/<ref>/mesh-<n>.glb` + provenance sidecar. The recipe stays sovereign. Place it in any world via a figures-map `meshRef` entry (+ `transform`).',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The sketch ref this mesh belongs to.' },
        glb_path: { type: 'string', description: 'Absolute path to the .glb on this host — or a .stl / .3mf (what OpenSCAD and slicers write), converted to a GLB at the door (3MF colour kept; an STL binds grey).' },
        source: { type: 'string', description: "Which tool made it (e.g. 'blender', 'text-to-cad/cadgen@0.5.0')." },
        note: { type: 'string', description: 'Free-text provenance note.' },
        units: { type: 'string', enum: ['mm', 'cm', 'm', 'in', 'ft'], description: "The FILE's unit (a CAD GLB is mm); converted into the sketch's declared unit via the sidecar, bytes untouched." },
        scale: { type: 'number', description: 'File units → world units, explicit (beats `units`).' },
        expected_box: { type: 'object', description: "{ min:[x,y,z], max:[x,y,z] } in file units — the CAD tool's own bbox; runs the 0.5×–2× size gate." },
      },
      required: ['ref', 'glb_path'],
    },
    handler: bindMeshRenderHandler,
  });
}
