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

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import {
  validateSketchManifest,
  expandGridLayout,
  STATION_KINDS,
  EDGE_VIA_VALUES,
  MARK_KINDS,
} from '@/lib/graph/sketch-manifest';
import { expandNeoRembrandt } from '@/lib/graph/neo-rembrandt/index.js';
import {
  getSketchVocabCard,
  listSketchVocab,
} from '@/lib/graph/sketch-vocab/loader';
import { deriveSketchDiffManifest } from '@/lib/graph/sketch-diff';
import {
  polygonizePrompt,
  resolvePolygonizerModelConfig,
  withConstellationGrid,
} from '@/lib/graph/polygonizer/index.js';

/**
 * Validate + persist a sketch, returning { ok, ref, url }. Shared by the
 * create_sketch MCP tool AND the plan-mode / research-mode auto-mint path
 * (which derives a manifest deterministically, then persists it here). Keeping
 * the "how a sketch is stored" logic in one place means the derived-sketch
 * callers get the same validation + ref + URL shape as a hand-authored one.
 */
export function mintSketch({ title, manifest, ref, folderRef } = {}) {
  if (!title || typeof title !== 'string') {
    throw new Error('`title` is required (string)');
  }
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (typeof folderRef !== 'string' || !folderRef) {
      throw new Error('`folderRef` must be a non-empty string or null if provided');
    }
    const folder = SketchFolderRepository.getByRef(folderRef);
    if (!folder) {
      throw new Error(`Folder '${folderRef}' not found`);
    }
  }
  // Resolve any grid `cell` placements to concrete x/y/w/h before validating
  // and storing, so the renderer only ever sees absolute coords.
  let expanded;
  try {
    expanded = expandNeoRembrandt(withConstellationGrid(expandGridLayout(manifest)));
  } catch (err) {
    throw new Error(`Rendrant expansion error: ${err.message}`);
  }
  const { ok, errors } = validateSketchManifest(expanded);
  if (!ok) {
    throw new Error(`Invalid manifest:\n - ${errors.join('\n - ')}`);
  }

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest: expanded, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
  };
}

export async function createSketchHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_sketch requires { title, manifest }');
  }
  const { title, manifest, ref, folder_ref: folderRef } = input;
  return mintSketch({ title, manifest, ref, folderRef });
}

export async function updateSketchHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('update_sketch requires { ref, title?, manifest?, folder_ref? }');
  }
  const { ref, title, manifest, folder_ref: folderRef } = input;
  if (!ref || typeof ref !== 'string') {
    throw new Error('`ref` is required (string)');
  }
  if (title === undefined && manifest === undefined && folderRef === undefined) {
    throw new Error('At least one of `title`, `manifest`, or `folder_ref` must be provided');
  }
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    throw new Error('`title` must be a non-empty string if provided');
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (typeof folderRef !== 'string' || !folderRef) {
      throw new Error('`folder_ref` must be a non-empty string or null if provided');
    }
    const folder = SketchFolderRepository.getByRef(folderRef);
    if (!folder) {
      throw new Error(`Folder '${folderRef}' not found`);
    }
  }

  let nextManifest;
  if (manifest !== undefined) {
    let expanded;
    try {
      expanded = expandNeoRembrandt(withConstellationGrid(expandGridLayout(manifest)));
    } catch (err) {
      throw new Error(`Rendrant expansion error: ${err.message}`);
    }
    const { ok, errors } = validateSketchManifest(expanded);
    if (!ok) {
      throw new Error(`Invalid manifest:\n - ${errors.join('\n - ')}`);
    }
    nextManifest = expanded;
  }

  const updated = SketchRepository.update({
    ref,
    title: title !== undefined ? title.trim() : undefined,
    manifest: nextManifest,
    folderRef,
  });
  if (!updated) {
    throw new Error(`No sketch exists at ref '${ref}'`);
  }
  return {
    ok: true,
    ref: updated.ref,
    url: `/sketches/${encodeURIComponent(updated.ref)}`,
  };
}

export async function getSketchVocabHandler(input) {
  const id = input && typeof input === 'object' ? input.id : undefined;
  if (id === undefined || id === null || id === '') {
    return { cards: listSketchVocab() };
  }
  if (typeof id !== 'string') {
    throw new Error('`id` must be a string (a sketch_vocab source_ref)');
  }
  const card = getSketchVocabCard(id);
  if (!card) {
    const available = listSketchVocab().map((c) => c.id);
    throw new Error(
      `No sketch vocab card '${id}'. Available: ${available.join(', ') || '(none)'}`,
    );
  }
  return { card };
}

export async function diffSketchesHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('diff_sketches requires { left_ref, right_ref }');
  }
  const {
    left_ref,
    right_ref,
    title,
    ref,
    min_similarity = 0.25,
    force = false,
  } = input;
  if (!left_ref || typeof left_ref !== 'string') {
    throw new Error('`left_ref` is required (string)');
  }
  if (!right_ref || typeof right_ref !== 'string') {
    throw new Error('`right_ref` is required (string)');
  }
  if (left_ref === right_ref) {
    throw new Error('`left_ref` and `right_ref` must be different sketch refs');
  }
  if (title !== undefined && typeof title !== 'string') {
    throw new Error('`title` must be a string if provided');
  }
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  if (
    typeof min_similarity !== 'number' ||
    !Number.isFinite(min_similarity) ||
    min_similarity < 0 ||
    min_similarity > 1
  ) {
    throw new Error('`min_similarity` must be a number between 0 and 1');
  }
  if (typeof force !== 'boolean') {
    throw new Error('`force` must be a boolean if provided');
  }

  const left = SketchRepository.getByRef(left_ref);
  if (!left) throw new Error(`No sketch exists at left_ref '${left_ref}'`);
  const right = SketchRepository.getByRef(right_ref);
  if (!right) throw new Error(`No sketch exists at right_ref '${right_ref}'`);

  const diff = deriveSketchDiffManifest({
    left,
    right,
    leftRef: left_ref,
    rightRef: right_ref,
    title,
    minSimilarity: min_similarity,
    force,
  });
  if (!diff.comparable) {
    return {
      ok: false,
      verdict: 'too_different',
      similarity: diff.similarity,
      summary: diff.summary,
      message:
        'Sketches do not appear comparable enough for a useful visual diff. Pass force:true to mint a low-confidence comparison anyway.',
    };
  }

  const minted = mintSketch({
    title: title || `Sketch diff: ${left_ref} -> ${right_ref}`,
    manifest: diff.manifest,
    ref,
  });
  return {
    ...minted,
    verdict: force && diff.similarity < min_similarity ? 'forced_low_confidence' : 'diff_created',
    similarity: diff.similarity,
    summary: diff.summary,
  };
}

export async function createPolygonizedSketchHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_polygonized_sketch requires { prompt }');
  }
  const {
    prompt,
    provider,
    model,
    apiKey,
    apiKeyId,
    repair = 'auto',
    ref,
    title,
    mint = true,
  } = input;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('`prompt` is required');
  }
  if (repair !== 'off' && repair !== 'auto') {
    throw new Error('`repair` must be "off" or "auto"');
  }
  const config = await resolvePolygonizerModelConfig({ provider, apiKey, apiKeyId, model });
  const result = await polygonizePrompt({
    prompt,
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    maxRepairs: repair === 'auto' ? 1 : 0,
  });

  if (!result.ok) {
    return {
      ok: false,
      attempts: result.attempts,
      provider: config.provider,
      model: config.model,
      errors: result.errors,
      repairPrompt: result.repairPrompt,
      manifest: result.manifest,
    };
  }

  const response = {
    ok: true,
    attempts: result.attempts,
    provider: config.provider,
    model: config.model,
    manifest: result.manifest,
    expandedManifest: result.expandedManifest,
  };
  if (mint) {
    response.sketch = mintSketch({
      title: title || result.manifest?.title || prompt,
      manifest: result.manifest,
      ref,
    });
  }
  return response;
}

export function registerSketchTools() {
  registerTool({
    name: 'create_sketch',
    description:
      "Mint a flow-charty diagram the operator can view in the control-plane UI. Use this to depict a workflow, a data flow, a decision chain, or any structure that's easier shown than described — without rearchitecting an overlay. The manifest mirrors the curated app-creation-map at /graph. Stations are positioned with explicit x/y/w/h (pixel coords inside the viewBox). Station kinds are " +
      STATION_KINDS.map((k) => `\`${k}\``).join(' | ') +
      " — pick the closest fit (e.g. `mcp_tool` for any callable/process, `filesystem` for files/payloads/messages-in-motion, `db_row` for durable records, `input` for parameters/preconditions). Edges are `{ from, to, label?, via?, curvature? }`; `label` is the verb (e.g. \"writes\", \"reads\", \"triggers\"). The default path is an S-curve that goes between the two stations — fine when the straight line is clear, but it will slice through any station that happens to sit between the endpoints. Use `via` to route around when that happens: `via: 'right' | 'left' | 'top' | 'bottom'` exits the source on that side, runs along a channel just outside both stations' extents on that side, and re-enters the target from the same side. Pick the side opposite to whatever's in the way (right/left for vertical lanes, top/bottom for horizontal lanes). Use `curvature` (0.2 – 3, default 1) to swoop the default S-curve harder (> 1) or flatten it toward straight (< 1) — useful when two stations are close and the default curve looks awkward. " +
      "Beyond flow charts, the manifest also accepts `marks[]` — low-level chart primitives (" +
      MARK_KINDS.map((k) => `\`${k}\``).join(' | ') +
      ") that compose into stacked bars, donuts/rings, KPI tiles, radar, etc.; charts and stations can coexist in one manifest. The chart layout vocabulary is deliberately NOT inlined here — before building a chart, query `semantic_search({ query: \"<the user's intent>\", kinds: [\"sketch_vocab\"] })` and read the matched cards in full via `get_sketch_vocab` for the exact marks + layout math. Optional top-level `depiction` records the visual metacontext: display/panel count, related vs unrelated panels, panel blocking paradigm, per-panel constellation applicability, and eye-line layout intent. It is audit/layout metadata only; visible panels still lower to existing `grid`, `rect`, `line`, and `text` marks. Optional top-level `grid` { cols, rows, gap?, pad? } plus a per-node `cell` { col, row, colSpan?, rowSpan? } places panels/tiles into a grid instead of raw pixels (resolved to x/y/w/h before Rendrant expands the drawing); every node also takes an optional numeric `z` for paint order (ascending). Returns `{ ok, ref, url }` — hand the `url` to the user so they can open the sketch. The sketch persists across restarts at `/sketches/<ref>`.",
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
        manifest: {
          type: 'object',
          description:
            'Diagram manifest. Required: title, viewBox { width, height }. Provide stations[] (flow vocab) and/or marks[] (charts) — at least one. Rendrant resolves construction marks before storage; edges[] and grid are optional.',
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
                'Low-level chart/vector primitives composed into sketches (read the matching sketch_vocab card for chart paradigms). Common fields: kind, z?, fill?, stroke?, strokeWidth?, opacity?, dash?, blend?, elevate?, role?, closed?, weightRank?. Geometry by kind — rect{x,y,w,h,rx?} (or cell); circle{cx,cy,r}; wedge{cx,cy,r,rInner?,start,end} (start/end are fractions 0–1, clockwise from 12 o’clock); line{x1,y1,x2,y2}; polyline{points:[[x,y],…]}; polygon{points:[[x,y],…]}; blob{anchor:[x,y] OR gestureT,rx,ry,offset?,rotation?,wobble?,points?}; sphere{anchor:[x,y] OR cx,cy,r}; oval{anchor:[x,y] OR cx,cy,rx,ry}; egg{anchor:[x,y] OR cx,cy,rx,ry}; cylinder{anchor:[x,y] OR cx,cy,rx,height,depth?,openTop?}; volume{primitive:"cup",anchor:[x,y],height,rimWidth,footWidth,wallThickness?,rings?,openTop?} expands a hollow tapered ring-stack cup; form{mode:"abstract"|"animated"|"realistic",stock:"bipedal"|"plane-object",role?,anchor:[x,y],scale?,massTuning?,speciesStock?} compiles broad figure/object stocks into renderer-native marks; plane{anchor:[x,y],length,width,axis? OR points:[[x,y],...]}; solid{x,y,width,height,depth,depthOffset?,faces?} projects one cuboid into filled SVG plane faces; partition{target:"role",axis:"y",count,role?,thickness?} splits a previous solid into repeated shelf-board solids; array{role,count,from:[x,y],to:[x,y],upperFrom?,upperTo?,item:{kind:"line"|"solid",...}} repeats lines or solids along a path; cubieLattice{role,anchor:[x,y],cols?,rows?,layers?,cellSize?,gap?,depth?} expands into separated solid cubies whose gaps create negative space; planePreset{ref:"bookshelf",x,y,width,height,depth?,shelves?}; solidPreset{ref:"bookshelf",x,y,width,height,depth?,shelves?} projects 3D cuboids into filled SVG plane faces; object{ref:"bookshelf-wireframe",x,y,w,h,depth?,shelves?,columns?} legacy wireframe; text{x,y,value,size?,weight?,anchor?,color?,family?}. Optional top-level polygonizer records subject, impactPoint, realityFacts, and minimalAbstractions for prompt-to-grammar audit; polygonizer.pureMandala plus cameraPrimitive{kind:"two-point", vanishingPoints, horizonY?, cropBox?, showFullMandala?} expands a deterministic room projection with paired floor/ceiling grids and pinned elements. The audit fields are informational and do not render directly. Optional top-level scene.perspective:{mode:"one-point",horizonY?,vanishingPoint:[x,y],depthScale?} locks solid depth edges to the vanishing point. Cylinder tops are closed by default; use openTop:true only for intentional tubes; prefer volume{primitive:"cup"} for hollow tapered cups. Optional top-level gesture:{kind?,points:[[x,y],...]} lets compact blobs use gestureT 0..1; create_sketch resolves anchor/rotation before storage. P0 sticker painting: a closed polygon, sphere, oval, egg, cylinder, volume, plane, solid face, or compact blob may include shade:{algorithm:"form-light-stack", intensity?} and optional highlights:{algorithm:"form-light-stack", intensity?}; legacy shade:{algorithm:"convex-value-stack"} and highlights:{algorithm:"simple-highlight"} still work. Rendrant expands construction marks, compact blobs, round primitives, cylinders, volumes, form primitives, cubie lattices, solids, planes, plane presets, solid presets, legacy object assets, and algorithmic polygon stickers before storage.',
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
      },
      required: ['title', 'manifest'],
    },
    handler: createSketchHandler,
  });

  registerTool({
    name: 'update_sketch',
    description:
      "Revise an existing sketch in place — rename it, replace its manifest, or both — without minting a new ref. Use this to iterate on the same diagram during a back-and-forth with the operator (tweak a label, reroute an edge, swap a chart paradigm) so the Sketches index doesn't accumulate near-duplicate refs. Pass the existing `ref` plus whichever of `title` / `manifest` you're changing. The manifest, when provided, is validated and Rendrant-expanded exactly like `create_sketch`. Returns `{ ok, ref, url }`. If the operator wants to preserve the previous version too, mint a fresh sketch via `create_sketch` instead.",
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
    name: 'create_polygonized_sketch',
    description:
      'Generate a sketch from a natural-language visual prompt using the polygonizer one-trip orchestration path. The model returns polygonizer concept/picture/elements/draftingTable metadata plus compact construction marks; mojulo validates locally, expands through Rendrant into the existing sketch renderer path, optionally spends one repair trip on validation failure, and mints a sketch by default. Use this for pictorial/object/property/scene prompts where drafting-table composition and inside/outside reasoning matter. Returns provider/model metadata but never returns plaintext credentials.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Natural-language visual prompt to polygonize.',
        },
        repair: {
          type: 'string',
          enum: ['auto', 'off'],
          default: 'auto',
          description: 'auto spends one repair trip only if local validation fails; off returns repairPrompt instead.',
        },
        mint: {
          type: 'boolean',
          default: true,
          description: 'When true, persist the expanded sketch and return sketch.url. When false, only return manifests/validation result.',
        },
        ref: {
          type: 'string',
          description: 'Optional stable sketch ref if minting.',
        },
        title: {
          type: 'string',
          description: 'Optional sketch title if minting.',
        },
        provider: {
          type: 'string',
          enum: ['openai', 'anthropic', 'bedrock', 'ollama'],
          description: 'Optional provider override. Defaults to saved default LLM key, or ollama if no key is saved.',
        },
        model: {
          type: 'string',
          description: 'Optional model override. Defaults to the provider structured tier.',
        },
        apiKeyId: {
          type: 'string',
          description: 'Optional saved API key id. Plaintext stays server-side.',
        },
        apiKey: {
          type: 'string',
          description: 'Optional one-off API key/credential string. Prefer apiKeyId when possible.',
        },
      },
      required: ['prompt'],
    },
    handler: createPolygonizedSketchHandler,
  });
}
