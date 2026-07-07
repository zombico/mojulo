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

import path from 'node:path';
import { promises as fs } from 'node:fs';

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import {
  validateSketchManifest,
  expandGridLayout,
  STATION_KINDS,
  EDGE_VIA_VALUES,
  MARK_KINDS,
} from '@/lib/graph/sketch/sketch-manifest';
import { expandNeoRembrandt } from '@/lib/graph/neo-rembrandt/index.js';
import { improveFloorplanManifest } from '@/lib/graph/polygonizer/floorplan-bim.js';
import {
  getSketchVocabCard,
  listSketchVocab,
} from '@/lib/graph/sketch-vocab/loader';
import { deriveSketchDiffManifest } from '@/lib/graph/sketch/sketch-diff';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';
import {
  classifyPromptForCards,
  polygonizePrompt,
  resolvePolygonizerModelConfig,
  withConstellationGrid,
  lowerRecipeManifest,
  recipeFamilyAllowlist,
} from '@/lib/graph/polygonizer/index.js';

// Cap on the number of priors a single create_* call may carry forward.
// Eight covers picture-book usage (character + setting + palette + composition,
// with headroom for a fourth recurring element or two) while keeping the
// prior-context prefix from crowding out the new prompt.
export const PRELOAD_MAX_ITEMS = 8;

/**
 * Resolve a preload input → an array of prior sketches the new turn should
 * compose against, or `null` if nothing was passed. Used by `create_sketch`
 * and `create_polygonized_sketch` to let an agent seed a new scene with one
 * or more priors as advisory context (carrying something — character,
 * setting, palette, composition — across pages of a picture book, across
 * turns of an iterative exploration).
 *
 * Two input shapes are accepted; both resolve to the same internal array:
 *   - `string` → single ref, unlabeled (the original picture-book spike
 *     shape; left intact for backwards compat).
 *   - `Array<string | { ref, as?, note? }>` → multiple priors, optionally
 *     labeled with a free-form role tag (`as`) that becomes the heading text
 *     in the prior-context prefix the model sees, plus an optional
 *     per-item `note` round-tripped in the response. Capped at
 *     PRELOAD_MAX_ITEMS items.
 *
 * Portability uses the existing `sk_<ref>` handle — no hashing, no new
 * identity layer; the substrate's content-hash discipline is for bot turn
 * rows, not artifacts. Preload is advisory only: the new turn may extend,
 * modify, or ignore each prior as the new prompt requires.
 *
 * Returns `null` if no preload was provided, else an array of
 * `{ ref, title, manifest, as: string|null, note: string|null }` entries
 * (preserving caller order). Throws on bad input, unresolved refs, duplicate
 * refs, or over-cap arrays.
 */
export function resolvePreloads(preloadInput) {
  if (preloadInput === undefined || preloadInput === null) return null;

  const rawItems = Array.isArray(preloadInput) ? preloadInput : [preloadInput];
  if (rawItems.length === 0) return null;
  if (rawItems.length > PRELOAD_MAX_ITEMS) {
    throw new Error(
      `\`preload\` accepts at most ${PRELOAD_MAX_ITEMS} priors (got ${rawItems.length}). Consolidate roles or split the sequence into multiple calls.`,
    );
  }

  const normalized = rawItems.map((item, idx) => {
    if (typeof item === 'string') {
      if (!item.trim()) {
        throw new Error(
          `\`preload[${idx}]\` must be a non-empty string sketch ref (e.g. "sk_abc123def0")`,
        );
      }
      return { ref: item, as: null, note: null };
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(
        `\`preload[${idx}]\` must be a string ref or an object { ref, as?, note? } (got ${typeof item})`,
      );
    }
    const { ref, as, note } = item;
    if (typeof ref !== 'string' || !ref.trim()) {
      throw new Error(
        `\`preload[${idx}].ref\` must be a non-empty string sketch ref (e.g. "sk_abc123def0")`,
      );
    }
    if (as !== undefined && as !== null && (typeof as !== 'string' || !as.trim())) {
      throw new Error(
        `\`preload[${idx}].as\` must be a non-empty string if provided (free-form role label, e.g. "character", "setting")`,
      );
    }
    if (note !== undefined && note !== null && typeof note !== 'string') {
      throw new Error(`\`preload[${idx}].note\` must be a string if provided`);
    }
    return {
      ref,
      as: as && as.trim() ? as.trim() : null,
      note: note ?? null,
    };
  });

  const seen = new Set();
  for (const { ref } of normalized) {
    if (seen.has(ref)) {
      throw new Error(
        `\`preload\` contains duplicate ref '${ref}' — each prior may appear at most once`,
      );
    }
    seen.add(ref);
  }

  return normalized.map(({ ref, as, note }) => {
    const prior = SketchRepository.getByRef(ref);
    if (!prior) {
      throw new Error(
        `preload sketch '${ref}' not found — mint it via create_sketch / create_polygonized_sketch first, or pass a known sk_ ref`,
      );
    }
    return { ref: prior.ref, title: prior.title, manifest: prior.manifest, as, note };
  });
}

/**
 * Back-compat alias: single-ref resolver returning the prior sketch object
 * or `null`. Internal callers should prefer `resolvePreloads` directly.
 */
export function resolvePreloadSketch(preloadRef) {
  const list = resolvePreloads(preloadRef);
  if (!list) return null;
  if (list.length !== 1) {
    throw new Error('resolvePreloadSketch only accepts a single ref; use resolvePreloads for arrays');
  }
  const [only] = list;
  return { ref: only.ref, title: only.title, manifest: only.manifest };
}

/**
 * Validate + persist a sketch, returning { ok, ref, url }. Shared by the
 * create_sketch MCP tool AND the plan-mode / research-mode auto-mint path
 * (which derives a manifest deterministically, then persists it here). Keeping
 * the "how a sketch is stored" logic in one place means the derived-sketch
 * callers get the same validation + ref + URL shape as a hand-authored one.
 */
export function mintSketch({ title, manifest, ref, folderRef, bucket } = {}) {
  if (!title || typeof title !== 'string') {
    throw new Error('`title` is required (string)');
  }
  // Concern bucket override. Omit it and the bucket is derived from
  // `manifest.kind` (diagrams/flows → diagram → Sketches; perspective/css3d/
  // painterly → illustration → Maker). Pin it only to override an edge case —
  // it's the same sketch primitive either way.
  if (bucket !== undefined && bucket !== null && bucket !== 'diagram' && bucket !== 'illustration') {
    throw new Error("`bucket` must be 'diagram', 'illustration', or null if provided");
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
  // Lower a recipe-shaped manifest into a drawable one. Recipe shape means
  // `manifest.recipe = { kind: 'architecturalConstruction', style: 'victorian',
  // … }` — typically the terminal call from a `sketch_what_possible` knob-
  // resolution loop. `lowerRecipeManifest` is a no-op for manifests with no
  // `recipe` field, so chart/flow callers are unaffected.
  let working;
  try {
    working = lowerRecipeManifest(manifest);
  } catch (err) {
    throw new Error(`Recipe lowering error: ${err.message}`);
  }
  // Resolve any grid `cell` placements to concrete x/y/w/h before validating
  // and storing, so the renderer only ever sees absolute coords.
  let expanded;
  try {
    expanded = expandNeoRembrandt(withConstellationGrid(expandGridLayout(working)));
  } catch (err) {
    throw new Error(`Rendrant expansion error: ${err.message}`);
  }
  // House plans are graded + auto-improved at authoring time (a no-op for every other kind):
  // pick the best-scoring seed / cut a door into a stranded room, and stamp a `quality` grade so
  // the stored manifest carries its own quality signal. The render path stays pure (it just
  // regenerates this manifest). Grading must never block minting, so fall back on any error.
  let finalized = expanded;
  try {
    finalized = improveFloorplanManifest(expanded);
  } catch {
    finalized = expanded;
  }

  const { ok, errors } = validateSketchManifest(finalized);
  if (!ok) {
    throw new Error(`Invalid manifest:\n - ${errors.join('\n - ')}`);
  }

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest: finalized, ref, folderRef: folderRef ?? null, bucket: bucket ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  // Most sketches minted here are diagrams/illustrations (cheap on-demand SVG),
  // but a world/scene-kind manifest can arrive via create_sketch / the POST API
  // / "save as new". warmScenePng no-ops unless the kind renders heavy 3D.
  warmScenePng(sketch);

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
  const {
    title,
    manifest,
    ref,
    folder_ref: folderRef,
    bucket,
    preload,
    preloadMetadata,
  } = input;
  // create_sketch takes a fully-authored manifest, so preload is purely an
  // echo back so the agent can confirm the prior context it composed
  // against. No prepending — the manifest IS the answer. preloadMetadata is
  // a free-form note slot the agent uses to record what it carried forward
  // and why; we round-trip it without interpreting. When `preload` is the
  // labeled-array form, the response mirrors the array shape under the same
  // key and `preloadMetadata` is folded into the first entry's note slot
  // (only for the unlabeled single-string form does the top-level metadata
  // make sense).
  const priors = resolvePreloads(preload);
  const result = mintSketch({ title, manifest, ref, folderRef, bucket });
  if (priors) {
    if (!Array.isArray(preload)) {
      const [only] = priors;
      result.preload = {
        ref: only.ref,
        title: only.title,
        manifest: only.manifest,
        metadata: preloadMetadata ?? null,
      };
    } else {
      result.preload = priors.map((p) => ({
        ref: p.ref,
        title: p.title,
        manifest: p.manifest,
        as: p.as,
        note: p.note,
      }));
    }
  }
  return result;
}

export async function updateSketchHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('update_sketch requires { ref, title?, manifest?, folder_ref? }');
  }
  const { ref, title, manifest, folder_ref: folderRef, bucket } = input;
  if (!ref || typeof ref !== 'string') {
    throw new Error('`ref` is required (string)');
  }
  if (title === undefined && manifest === undefined && folderRef === undefined && bucket === undefined) {
    throw new Error('At least one of `title`, `manifest`, `folder_ref`, or `bucket` must be provided');
  }
  // Concern bucket override: pin the owning concern, or pass null to drop back
  // to the kind-derived bucket. The sketch is the same primitive either way.
  if (bucket !== undefined && bucket !== null && bucket !== 'diagram' && bucket !== 'illustration') {
    throw new Error("`bucket` must be 'diagram', 'illustration', or null if provided");
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
    let finalized = expanded;
    try {
      finalized = improveFloorplanManifest(expanded);   // grade + auto-improve floorplans; no-op otherwise
    } catch {
      finalized = expanded;
    }
    const { ok, errors } = validateSketchManifest(finalized);
    if (!ok) {
      throw new Error(`Invalid manifest:\n - ${errors.join('\n - ')}`);
    }
    nextManifest = finalized;
  }

  const updated = SketchRepository.update({
    ref,
    title: title !== undefined ? title.trim() : undefined,
    manifest: nextManifest,
    folderRef,
    bucket,
  });
  if (!updated) {
    throw new Error(`No sketch exists at ref '${ref}'`);
  }
  // A changed manifest is a new PNG cache key, so the previous warm is stale —
  // re-bake in the background off the validated manifest. Title/folder/bucket-
  // only edits don't change the key, so they skip the warm.
  if (nextManifest !== undefined) {
    warmScenePng({ ref: updated.ref, manifest: nextManifest });
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
        'Sketches do not appear comparable enough for a useful visual diff. next: re-call with force:true if you really want the low-confidence comparison, or diff nearer revisions.',
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
    mode = 'one-trip',
    preload,
    preloadMetadata,
  } = input;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('`prompt` is required');
  }
  if (repair !== 'off' && repair !== 'auto') {
    throw new Error('`repair` must be "off" or "auto"');
  }
  if (mode !== 'one-trip' && mode !== 'plan-then-skin') {
    throw new Error('`mode` must be "one-trip" or "plan-then-skin"');
  }
  const priors = resolvePreloads(preload);
  const config = await resolvePolygonizerModelConfig({ provider, apiKey, apiKeyId, model });

  // Pre-pass: pick the render-primitive / recipe cards the prompt is likely
  // to need so the manifest system prompt only ships the relevant grammar.
  // Defaults to a local-embedding similarity lookup (one CPU call, no
  // network — see polygonizer/card-router.js); the previous Haiku-class
  // LLM round-trip is now reachable only by explicit override. Cached by
  // prompt hash. On router failure the helper falls back to 'all' cards —
  // the same safety net repair uses — so the manifest call still has full
  // grammar.
  const classification = await classifyPromptForCards({ prompt });

  const result = await polygonizePrompt({
    prompt,
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    maxRepairs: repair === 'auto' ? 1 : 0,
    cards: classification.cards,
    mode,
    preloadManifests: priors,
  });

  // Mirror create_sketch's echo policy: single-string input → object echo
  // with top-level metadata; array input → array echo with per-item `as` +
  // `note`. The polygonizer already received the manifest, so we don't
  // re-include it in the echo (just the handles the agent passed in).
  let preloadEcho = null;
  if (priors) {
    if (!Array.isArray(preload)) {
      const [only] = priors;
      preloadEcho = { ref: only.ref, title: only.title, metadata: preloadMetadata ?? null };
    } else {
      preloadEcho = priors.map((p) => ({ ref: p.ref, title: p.title, as: p.as, note: p.note }));
    }
  }

  if (!result.ok) {
    const errorResponse = {
      ok: false,
      attempts: result.attempts,
      mode,
      provider: config.provider,
      model: config.model,
      classification,
      errors: result.errors,
      repairPrompt: result.repairPrompt,
      manifest: result.manifest,
    };
    if (result.phase !== undefined) errorResponse.phase = result.phase;
    if (Array.isArray(result.turns)) errorResponse.turns = result.turns;
    if (result.authorshipPreview) errorResponse.authorshipPreview = result.authorshipPreview;
    if (result.scaffold) errorResponse.scaffold = result.scaffold;
    if (preloadEcho) errorResponse.preload = preloadEcho;
    return errorResponse;
  }

  const response = {
    ok: true,
    attempts: result.attempts,
    mode,
    provider: config.provider,
    model: config.model,
    classification,
    manifest: result.manifest,
    expandedManifest: result.expandedManifest,
  };
  if (Array.isArray(result.turns)) response.turns = result.turns;
  if (result.authorshipPreview) response.authorshipPreview = result.authorshipPreview;
  if (result.scaffold) response.scaffold = result.scaffold;
  if (preloadEcho) response.preload = preloadEcho;
  if (mint) {
    response.sketch = mintSketch({
      title: title || result.manifest?.title || prompt,
      manifest: result.manifest,
      ref,
    });
  }
  return response;
}

// On-disk location for written .glb exports. Overridable for tests / alternate data roots;
// defaults beside the other generated artifacts under control/data/.
function exportsBaseDir() {
  return process.env.MOJULO_EXPORTS_DIR || path.join(process.cwd(), 'data', 'exports');
}

/**
 * export_model — serialize a stored sketch's traversable World as a .glb.
 *
 * Resolves the SAME baked geometry the /world route renders (via the shared
 * world-scene seam), so the exported mesh matches the live World. Returns the
 * download URL plus, when `write` is true (default), an on-disk path the host agent
 * can open or move. Sketches with no World form return { ok:false, eligible:false }.
 */
export async function exportModelHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('export_model requires { ref }');
  }
  const { ref, write = true } = input;
  if (!ref || typeof ref !== 'string') {
    throw new Error('`ref` is required (string)');
  }
  if (typeof write !== 'boolean') {
    throw new Error('`write` must be a boolean if provided');
  }
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) {
    throw new Error(`No sketch exists at ref '${ref}'`);
  }
  if (!sketch.manifest) {
    throw new Error(`Sketch '${ref}' has no manifest`);
  }

  const { payload, kind } = await resolveWorldScene(sketch);
  const exported = payload ? facesToGlb(payload, { generator: `mojulo ${ref}` }) : null;
  const url = `/api/sketches/${encodeURIComponent(ref)}/model.glb`;
  if (!exported) {
    return {
      ok: false,
      eligible: false,
      ref,
      kind: kind ?? null,
      reason:
        'This sketch has no traversable World geometry to export. glTF export covers the World '
        + 'kinds (cities, transportation hubs, subway interiors, painted-landscape terrain, '
        + 'workbench/assembler studies, vehicle instances, the science views, and furnished rooms). '
        + 'Diagrams, charts, and CSS-3D-only turntables are not exportable.',
      scene_url: `/api/sketches/${encodeURIComponent(ref)}/scene`,
      svg_url: `/api/sketches/${encodeURIComponent(ref)}/svg`,
    };
  }

  const result = {
    ok: true,
    ref,
    kind: kind ?? null,
    format: 'glb',
    url,
    bytes: exported.byteLength,
    nodes: exported.nodeCount,
    vertices: exported.vertexCount,
    triangles: exported.triangleCount,
  };
  if (write) {
    const dir = exportsBaseDir();
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${ref}.glb`);
    await fs.writeFile(file, exported.bytes);
    result.path = file;
  }
  return result;
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
      'Generate a sketch from a natural-language visual prompt. Default `mode: "one-trip"` runs the classic single-pass polygonizer orchestration; `mode: "plan-then-skin"` runs the two-turn protocol — turn 1 emits a planning manifest (no marks), mojulo validates it through the authorship-preview gate and computes a solved scaffold, then turn 2 emits marks against that scaffold. The two-turn path partitions failures: planning errors don\'t waste mark-generation tokens, and skin errors don\'t invalidate planning. Use one-trip for flat scenes (portraits, charts, single figures); use plan-then-skin for scenes with perspective/support/collision concerns (room interiors, vision panes, architectural construction, multi-figure scenes). Response surfaces `attempts`, `mode`, and (for plan-then-skin) `turns[]`, `phase` on failure, `authorshipPreview`, and `scaffold`. Returns provider/model metadata but never returns plaintext credentials.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Natural-language visual prompt to polygonize.',
        },
        mode: {
          type: 'string',
          enum: ['one-trip', 'plan-then-skin'],
          default: 'one-trip',
          description: 'Orchestration mode. "one-trip" emits the full manifest in one model call. "plan-then-skin" runs a planning turn (no marks) gated by the consensus 5a authorship-preview, builds a solved scaffold, then a skin turn that emits marks against the scaffold.',
        },
        repair: {
          type: 'string',
          enum: ['auto', 'off'],
          default: 'auto',
          description: 'auto spends one repair trip only if local validation fails; off returns repairPrompt instead. In plan-then-skin mode, the repair budget applies independently to planning and skin turns.',
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
                          "Free-form role label for this prior — e.g. 'character', 'setting', 'palette', 'composition'. Becomes the section heading in the prior-context prefix the polygonizer model sees, so it knows which prior plays which role in the new scene.",
                      },
                      note: {
                        type: 'string',
                        description:
                          'Optional per-prior note (e.g. "the fox\'s pose"). Surfaced to the model alongside the prior manifest and round-tripped in the response.',
                      },
                    },
                    required: ['ref'],
                  },
                ],
              },
            },
          ],
          description:
            "Optional prior sketch ref (`sk_…`) — or an array of refs / labeled-ref objects — to seed the polygonizer turn with as advisory context. The single-string form prefixes the resolved prior manifest under a 'Prior scene' header. The array-of-labeled-objects form prefixes each prior under its own 'Prior {as}' header (one labeled section per item), so the model can compose a new page from, e.g., a recurring character + a recurring setting carried from earlier sketches. Advisory only — no enforcement, no role-pinning, no validation that prior elements survive the new turn; the model may extend, modify, or ignore any prior. In plan-then-skin mode the preload is fed to the planning turn only; the skin turn sees the solved scaffold instead. Errors if any ref doesn't resolve. Capped at " +
            PRELOAD_MAX_ITEMS +
            ' priors per call.',
        },
        preloadMetadata: {
          type: 'object',
          additionalProperties: true,
          description:
            "Optional free-form note slot for the agent's own use describing what was carried forward from `preload` (which roles, what intent). Round-tripped verbatim in the `preload` field of the response when `preload` is a single string. Ignored when `preload` is an array (use the per-item `note` field instead) or absent.",
        },
      },
      required: ['prompt'],
    },
    handler: createPolygonizedSketchHandler,
  });

  registerTool({
    name: 'export_model',
    description:
      "Export a stored sketch's traversable 3D World as a binary glTF (.glb) the operator can open in Blender, Unreal, three.js, or macOS Quick Look — turning a depiction into a portable asset rather than a walled view. Pass the sketch `ref`. Works for the World kinds (fractal cities, transportation hubs, subway interiors, painted-landscape terrain, workbench/assembler object studies, vehicle instances, the science views — molecule/atom/cell/field/fluid/ocean/mechanics/orbit — and furnished rooms); diagrams, charts, and CSS-3D-only turntables have no exportable geometry and return `{ ok:false, eligible:false }` with pointers to /scene and /svg. Fidelity: mojulo's lighting is BAKED into the geometry and the mesh is exported UNLIT (glTF KHR_materials_unlit + per-vertex colours), so it looks identical to the live World from any camera with no lighting setup downstream — the depiction is the asset, not a re-lightable PBR approximation. Camera-facing glow billboards and the sky dome are dropped (not geometry); gradient-painted faces collapse to a single colour; animated channels export at their static pose. Returns `{ ok, ref, kind, url, bytes, nodes, vertices, triangles }` plus, when `write` is true (the default), an on-disk `path` to the written .glb. The `url` (`/api/sketches/<ref>/model.glb`) regenerates the file deterministically on each request, so hand it to the operator for a browser download.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Existing sketch ref (`sk_…`) to export. Errors if no sketch with this ref exists.',
        },
        write: {
          type: 'boolean',
          default: true,
          description:
            'When true (default), write the .glb to disk (under control/data/exports, or $MOJULO_EXPORTS_DIR) and return its `path` so the host agent can open or move the file. Set false to compute the export metadata + download URL without touching disk.',
        },
      },
      required: ['ref'],
    },
    handler: exportModelHandler,
  });
}
