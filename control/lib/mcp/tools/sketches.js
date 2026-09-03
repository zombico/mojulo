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
import { STATION_KINDS, EDGE_VIA_VALUES, MARK_KINDS } from '@/lib/graph/sketch/sketch-manifest';
import { recipeFamilyAllowlist } from '@/lib/graph/polygonizer/index.js';

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

export function registerSketchTools() {
  registerTool({
    name: 'create_sketch',
    description:
      "Mint a flow-charty diagram the operator can view in the control-plane UI. Use this to depict a workflow, a data flow, a decision chain, or any structure that's easier shown than described — without rearchitecting an overlay. The manifest mirrors the curated app-creation-map at /graph. Stations are positioned with explicit x/y/w/h (pixel coords inside the viewBox). Station kinds are " +
      STATION_KINDS.map((k) => `\`${k}\``).join(' | ') +
      " — pick the closest fit (e.g. `mcp_tool` for any callable/process, `filesystem` for files/payloads/messages-in-motion, `db_row` for durable records, `input` for parameters/preconditions). Edges are `{ from, to, label?, via?, curvature? }`; `label` is the verb (e.g. \"writes\", \"reads\", \"triggers\"). The default path is an S-curve that goes between the two stations — fine when the straight line is clear, but it will slice through any station that happens to sit between the endpoints. Use `via` to route around when that happens: `via: 'right' | 'left' | 'top' | 'bottom'` exits the source on that side, runs along a channel just outside both stations' extents on that side, and re-enters the target from the same side. Pick the side opposite to whatever's in the way (right/left for vertical lanes, top/bottom for horizontal lanes). Use `curvature` (0.2 – 3, default 1) to swoop the default S-curve harder (> 1) or flatten it toward straight (< 1) — useful when two stations are close and the default curve looks awkward. " +
      "Beyond flow charts, the manifest also accepts `marks[]` — low-level chart primitives (" +
      MARK_KINDS.map((k) => `\`${k}\``).join(' | ') +
      ") that compose into stacked bars, donuts/rings, KPI tiles, radar, etc.; charts and stations can coexist in one manifest. The chart layout vocabulary is deliberately NOT inlined here — before building a chart, query `semantic_search({ query: \"<the user's intent>\", kinds: [\"sketch_vocab\"] })` and read the matched cards in full via `get_sketch_vocab` for the exact marks + layout math. Optional top-level `depiction` records the visual metacontext: display/panel count, related vs unrelated panels, panel blocking paradigm, per-panel constellation applicability, and eye-line layout intent. It is audit/layout metadata only; visible panels still lower to existing `grid`, `rect`, `line`, and `text` marks. Optional top-level `grid` { cols, rows, gap?, pad? } plus a per-node `cell` { col, row, colSpan?, rowSpan? } places panels/tiles into a grid instead of raw pixels (resolved to x/y/w/h before Rendrant expands the drawing); every node also takes an optional numeric `z` for paint order (ascending). " +
      "As an alternative to `marks[]`, scene/figure illustration uses a recipe-shaped manifest: top-level `recipe: { kind, ...knobs }` where `kind` is one of " +
      recipeFamilyAllowlist().map((k) => `\`${k}\``).join(' | ') +
      " and the knob set is family-specific (architecturalConstruction takes style/roof/door/porch/steps/chimney; portraitBust takes its own; etc). The recipe is compiled deterministically into marks before persistence — no LLM in the lowering. This is the terminal step of the `sketch_what_possible` inverse-stable-diffusion loop: query → narrate underdetermined knobs to user → accumulate decisions → `create_sketch({ recipe: { kind, ...accumulated } })`. Don't hand-author marks for an illustration family unless you know the recipe doesn't cover what you need. " +
      "Returns `{ ok, ref, url }` — hand the `url` to the user so they can open the sketch. The sketch persists across restarts at `/sketches/<ref>`.",
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title shown in the page header.',
        },
        ref: {
          type: 'string',
          description:
            'Optional stable ref (1-64 chars of [A-Za-z0-9_-]). If omitted, a `sk_<10-char>` ref is generated. Errors if a sketch with this ref already exists.',
        },
        folder_ref: {
          type: 'string',
          description:
            'Optional folder ref (a `fld_<…>` id from the operator) to drop this sketch into. When the operator opens the New-sketch modal while viewing a folder, the modal embeds the folder ref in the starter prompt so the agent can pass it here. Omit to leave the sketch at root.',
        },
        bucket: {
          type: 'string',
          enum: ['diagram', 'illustration'],
          description:
            "Optional concern override. Omit it (the default) and the bucket is derived from `manifest.kind`: diagrams and flows → 'diagram' (the Sketches concern, /sketches), a landscape or complicated figure in a perspective/css3d/painterly context → 'illustration' (the Mojulo Maker concern, /maker). Only set this to override an edge case. A diagram and an illustration are the same sketch primitive — stash, reference, and diff all work identically; the bucket only decides which sibling concern owns it.",
        },
        manifest: {
          type: 'object',
          description:
            'Diagram manifest. Required: title, viewBox { width, height }. Provide stations[] (flow vocab) and/or marks[] (charts) — at least one. Rendrant resolves construction marks before storage; edges[] and grid are optional. '
            + "Alternatively `manifest.kind` selects a kind-dispatched manifest with its OWN shape (no stations/marks): `image-outcome` / `sequential-art` / `character-sheet` (externally-painted stills + comics), `keyframe-animation` (raster character animation cels), `scene-motion` (clips staged over plates with cuts). Read that kind's sketch_vocab card (`get_sketch_vocab`) for the manifest contract before minting.",
          properties: {
            title: { type: 'string' },
            viewBox: {
              type: 'object',
              properties: {
                width: { type: 'number' },
                height: { type: 'number' },
              },
              required: ['width', 'height'],
            },
            grid: {
              type: 'object',
              description:
                'Optional layout grid. Box-shaped nodes (rect marks, stations) may carry `cell` instead of x/y/w/h; resolved to pixels before render.',
              properties: {
                cols: { type: 'number' },
                rows: { type: 'number' },
                gap: { type: 'number', description: 'Default 16.' },
                pad: { type: 'number', description: 'Outer margin. Default 40.' },
              },
              required: ['cols', 'rows'],
            },
            depiction: {
              type: 'object',
              description:
                'Optional visual metacontext. Use for display/panel count, panel blocking paradigm, related vs unrelated panel mode, per-panel constellation applicability, and eye-line layout intent. Does not render directly.',
              additionalProperties: true,
            },
            stations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique within this manifest; referenced by edges.' },
                  kind: { type: 'string', enum: STATION_KINDS },
                  label: { type: 'string' },
                  sublabel: { type: 'string' },
                  items: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Bullet rows shown inside the station box.',
                  },
                  x: { type: 'number' },
                  y: { type: 'number' },
                  w: { type: 'number' },
                  h: { type: 'number' },
                  z: { type: 'number', description: 'Optional paint order (ascending).' },
                  cell: {
                    type: 'object',
                    description: 'Grid placement (needs top-level `grid`); alternative to x/y/w/h.',
                    properties: {
                      col: { type: 'number' },
                      row: { type: 'number' },
                      colSpan: { type: 'number' },
                      rowSpan: { type: 'number' },
                    },
                    required: ['col', 'row'],
                  },
                },
                required: ['id', 'kind', 'label'],
              },
            },
            marks: {
              type: 'array',
              description:
                'Low-level chart/vector primitives composed into sketches (read the matching sketch_vocab card for chart paradigms). Common fields: kind, z?, fill?, stroke?, strokeWidth?, opacity?, dash?, blend?, elevate?, role?, closed?, weightRank?. Geometry by kind — rect{x,y,w,h,rx?} (or cell); circle{cx,cy,r}; wedge{cx,cy,r,rInner?,start,end} (start/end are fractions 0–1, clockwise from 12 o’clock); line{x1,y1,x2,y2}; polyline{points:[[x,y],…]}; polygon{points:[[x,y],…]}; blob{anchor:[x,y] OR gestureT,rx,ry,offset?,rotation?,wobble?,points?}; sphere{anchor:[x,y] OR cx,cy,r}; oval{anchor:[x,y] OR cx,cy,rx,ry}; egg{anchor:[x,y] OR cx,cy,rx,ry}; cylinder{anchor:[x,y] OR cx,cy,rx,height,depth?,openTop?}; volume{primitive:"cup",anchor:[x,y],height,rimWidth,footWidth,wallThickness?,rings?,openTop?} expands a hollow tapered ring-stack cup; form{mode:"abstract"|"animated"|"realistic",stock:"bipedal"|"plane-object",role?,anchor:[x,y],scale?,massTuning?,speciesStock?} compiles broad figure/object stocks into renderer-native marks; plane{anchor:[x,y],length,width,axis? OR points:[[x,y],...]}; solid{x,y,width,height,depth,depthOffset?,faces?} projects one cuboid into filled SVG plane faces; partition{target:"role",axis:"y",count,role?,thickness?} splits a previous solid into repeated shelf-board solids; array{role,count,from:[x,y],to:[x,y],upperFrom?,upperTo?,item:{kind:"line"|"solid",...}} repeats lines or solids along a path; cubieLattice{role,anchor:[x,y],cols?,rows?,layers?,cellSize?,gap?,depth?} expands into separated solid cubies whose gaps create negative space; arabesque{mode:"field"|"rosette"|"medallion",pattern?:"hex"|"square"|"khatam",n?,contactAngle?,cols?,rows?,interlace?,fill?,cx?,cy?,size?,starFill?,petalFill?,coreFill?} constructs Islamic geometric star patterns / rosettes (shams) / concentric medallions via polygons-in-contact and lowers to polygon/polyline/circle marks (read the `arabesque` sketch_vocab card); planePreset{ref:"bookshelf",x,y,width,height,depth?,shelves?}; solidPreset{ref:"bookshelf",x,y,width,height,depth?,shelves?} projects 3D cuboids into filled SVG plane faces; object{ref:"bookshelf-wireframe",x,y,w,h,depth?,shelves?,columns?} legacy wireframe; text{x,y,value,size?,weight?,anchor?,color?,family?}. Optional top-level polygonizer records subject, impactPoint, realityFacts, and minimalAbstractions for prompt-to-grammar audit; polygonizer.pureMandala plus cameraPrimitive{kind:"two-point", vanishingPoints, horizonY?, cropBox?, showFullMandala?} expands a deterministic room projection with paired floor/ceiling grids and pinned elements. The audit fields are informational and do not render directly. Optional top-level scene.perspective:{mode:"one-point",horizonY?,vanishingPoint:[x,y],depthScale?} locks solid depth edges to the vanishing point. Cylinder tops are closed by default; use openTop:true only for intentional tubes; prefer volume{primitive:"cup"} for hollow tapered cups. Optional top-level gesture:{kind?,points:[[x,y],...]} lets compact blobs use gestureT 0..1; create_sketch resolves anchor/rotation before storage. P0 sticker painting: a closed polygon, sphere, oval, egg, cylinder, volume, plane, solid face, or compact blob may include shade:{algorithm:"form-light-stack", intensity?} and optional highlights:{algorithm:"form-light-stack", intensity?}; legacy shade:{algorithm:"convex-value-stack"} and highlights:{algorithm:"simple-highlight"} still work. Rendrant expands construction marks, compact blobs, round primitives, cylinders, volumes, form primitives, cubie lattices, solids, planes, plane presets, solid presets, legacy object assets, and algorithmic polygon stickers before storage.',
              items: {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: MARK_KINDS },
                  z: { type: 'number' },
                },
                required: ['kind'],
                additionalProperties: true,
              },
            },
            edges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string', description: 'Source station id.' },
                  to: { type: 'string', description: 'Destination station id.' },
                  label: { type: 'string', description: 'Edge verb (e.g. "writes", "reads", "triggers").' },
                  via: {
                    type: 'string',
                    enum: EDGE_VIA_VALUES,
                    description:
                      "Route around a channel outside the lane. Pick the side opposite to whatever station is in the way: 'right'/'left' for vertical lanes (when an edge skips stations stacked vertically), 'top'/'bottom' for horizontal lanes (when an edge skips stations laid out horizontally).",
                  },
                  curvature: {
                    type: 'number',
                    minimum: 0.2,
                    maximum: 3,
                    description:
                      "Multiplier on the default S-curve's control-point offset. 1 (default) is the original curve; > 1 swoops harder so the curve clears territory near the straight line; < 1 flattens toward straight (good for short hops where a tight S looks awkward). Ignored when `via` is set.",
                  },
                },
                required: ['from', 'to'],
              },
            },
          },
          required: ['title', 'viewBox'],
        },
        preload: {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              maxItems: PRELOAD_MAX_ITEMS,
              items: {
                oneOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: {
                      ref: { type: 'string', description: 'Prior sketch ref (`sk_…`).' },
                      as: {
                        type: 'string',
                        description:
                          "Free-form role label for this prior — e.g. 'character', 'setting', 'palette', 'composition'. Becomes the heading the polygonizer model sees in the prior-context prefix; here on create_sketch it's echoed back in the response.",
                      },
                      note: {
                        type: 'string',
                        description:
                          'Optional per-prior note (e.g. "the fox\'s pose"). Round-tripped in the response; not interpreted by the substrate.',
                      },
                    },
                    required: ['ref'],
                  },
                ],
              },
            },
          ],
          description:
            "Optional prior sketch ref (`sk_…`) — or an array of refs / labeled-ref objects — the agent composed the new manifest against. Advisory only: `create_sketch` takes a fully-authored manifest, so preload is round-tripped in the response (so the agent can confirm what it carried forward), not blended into the saved sketch. The single-string form marks a sketch's provenance when it derives from an earlier one (a picture-book page continuing a prior scene). The array-of-labeled-objects form lets a sketch carry MULTIPLE priors with distinct roles (e.g. one ref `as: 'character'` + a different ref `as: 'setting'`), useful for composing pages that recombine a recurring cast against a recurring environment. Capped at " +
            PRELOAD_MAX_ITEMS +
            ' priors per call.',
        },
        preloadMetadata: {
          type: 'object',
          additionalProperties: true,
          description:
            "Optional free-form note slot for the agent's own use describing what was carried forward from `preload` (which roles, what intent). Round-tripped verbatim in the response when `preload` is a single string. Ignored when `preload` is an array (use the per-item `note` field instead) or absent.",
        },
      },
      required: ['title', 'manifest'],
    },
    handler: createSketchHandler,
  });

  registerTool({
    name: 'update_sketch',
    description:
      "Revise an existing sketch in place — rename it, replace its manifest, or both — same ref. The ITERATE surface for every sketch-stored recipe: diagrams, worlds, solids/figures, edifices, views, image-outcomes, and kind:'game' manifests. Each kind pays its own gate — diagrams validate like `create_sketch`; world/solid kinds resolve through the world registry (the render contract itself); games pay create_game's structural gate (levels added by an edit are noted unaudited). Beats/voice refuse here and point at their domain tools. `manifest` is a FULL replacement: read the stored one, edit, write back. Returns `{ ok, ref, url, note? }`. Re-mint only for a side-by-side variant.",
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
            'Full replacement manifest (same shape as create_sketch). Omit to leave the manifest unchanged. When provided, it fully overwrites the previous manifest — there is no partial/patch merge.',
        },
        folder_ref: {
          type: 'string',
          description:
            'Optional folder ref to move the sketch into. Pass an empty string or null to move it back to root. Omit to leave the folder unchanged.',
        },
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
  });

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

  registerTool({
    name: 'export_model',
    description:
      "Export a stored sketch's traversable 3D World as a binary glTF (.glb) the operator can open in Blender, Unreal, three.js, or macOS Quick Look — turning a depiction into a portable asset rather than a walled view. Pass the sketch `ref`. Works for the World kinds (fractal cities, transportation hubs, subway interiors, painted-landscape terrain, workbench/assembler object studies, **`manji-tree` polygomers** (the SAME ref serves `/world` and exports here, bonded lathes lowered to baked faces, `skin_polygomer` skins baked into vertex colours), vehicle instances, the science views, furnished rooms, posed `figure` sketches, `carved-solid` wordmarks, and `css3d-turntable` solids); flat diagrams and charts have no exportable geometry and return `{ ok:false, eligible:false }` with pointers to /scene and /svg. Fidelity: mojulo's lighting is BAKED into the geometry and the mesh is exported UNLIT (glTF KHR_materials_unlit + per-vertex colours), so it looks identical to the live World from any camera with no lighting setup downstream — the depiction is the asset, not a re-lightable PBR approximation. Camera-facing glow billboards and the sky dome are dropped (not geometry); gradient-painted faces collapse to a single colour; animated channels export at their static pose. Pass `format: 'stl'` for the 3D-PRINTING handoff instead: a binary STL for slicers — shape only (colour/textures dropped; water/decals/studio grid omitted; repeats expanded; z-up). Sizing is print-profile-aware: literal object kinds (workbench/assembler/carved-solid/turntable/vehicle) derive mm from `units`; worlds, views, and figures print as MINIATURES fit to `target_mm` (default 120). Honest triangle soup, not guaranteed-manifold — results report an advisory `closure` audit + printed size. Returns `{ ok, ref, kind, format, url, bytes, vertices, triangles }` (+ `nodes` for glb) plus, when `write` is true (the default), an on-disk `path` to the written file. The `url` (`/api/sketches/<ref>/model.glb` or `.stl`) regenerates the file deterministically on each request, so hand it to the operator for a browser download. Rig worlds: pass `clips` (names array or '_all') to bake figure/unit/vehicle rig clips into glTF animations (1s per cycle).",
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
          description: 'With `clips`: export each rig figure as ONE SkinnedMesh (JOINTS_0/WEIGHTS_0 + skins/IBM — soft weights across joints where the rig carries bone segments, hard-bound otherwise) so the engine deforms smooth flesh. Off (default): rigid part nodes, byte-identical to before.',
        },
        format: {
          type: 'string',
          enum: ['glb', 'stl'],
          default: 'glb',
          description:
            "'glb' (default): faithful depiction capture — vertex colours, named group nodes, unlit. 'stl': binary STL for 3D printing — bare triangles, no colour.",
        },
        scale: {
          type: 'number',
          description:
            "STL only: world-units → mm multiplier; overrides all derivation. Literal kinds derive it from declared `units` (mm/cm/m/in/ft) when omitted; other kinds fit to `target_mm`. Echoed in the result and README.",
        },
        target_mm: {
          type: 'number',
          description:
            'STL only: fit the longest printed dimension to this many mm (non-literal kinds default to 120). Overrides `units` derivation; `scale` beats both.',
        },
        write: {
          type: 'boolean',
          default: true,
          description:
            'When true (default), write the export into the sketch outcome folder (data/outcomes/<ref>/, beside recipe.json + a provenance README) and return its `path`. Set false to compute the export metadata + download URL without touching disk.',
        },
      },
      required: ['ref'],
    },
    handler: exportModelHandler,
  });

  registerTool({
    name: 'bind_mesh_render',
    description:
      'Bind an externally refined `.glb` (e.g. a Blender pass over an `export_model` export) back onto its sketch as an append-only DERIVED artifact: GLB-validated at the door, snapshotted to `data/outcomes/<ref>/mesh-<n>.glb` + provenance sidecar (sha256/bytes/source/date). The recipe stays sovereign — no geometry enters the manifest. Place it in any world via a figures-map `meshRef` entry (+ optional `transform`): lowered server-side to faces, so /world, the stills, and re-export all render it.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The sketch ref this refined mesh belongs to.' },
        glb_path: { type: 'string', description: 'Absolute path to the refined .glb on this host.' },
        source: { type: 'string', description: "Optional structured which-tool tag for the provenance sidecar (e.g. 'blender', 'freecad') — parity with the image seam's source field." },
        note: { type: 'string', description: 'Optional free-text provenance note (what changed).' },
      },
      required: ['ref', 'glb_path'],
    },
    handler: bindMeshRenderHandler,
  });
}
