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
import { exportsBaseDir } from './exports-dir.js';
import { isBeatsKind } from '@/lib/graph/beats/beats-manifest';
import { isVoiceRegisterKind } from '@/lib/graph/voice/voice-register';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { facesToGlb } from '@/lib/graph/scene/scene-gltf';
import { facesToStl } from '@/lib/graph/scene/scene-stl';
import {
  validateSketchManifest,
  expandGridLayout,
  STATION_KINDS,
  EDGE_VIA_VALUES,
  MARK_KINDS,
} from '@/lib/graph/sketch/sketch-manifest';
import { expandNeoRembrandt } from '@/lib/graph/neo-rembrandt/index.js';
import {
  isImageOutcomesKind,
  normalizeImageOutcomesManifest,
  renderTargets,
  parseKeyframeTarget,
  KIND_IMAGE_OUTCOME,
  KIND_SEQUENTIAL_ART,
  KIND_CHARACTER_SHEET,
  KIND_KEYFRAME_ANIMATION,
  KIND_SCENE_MOTION,
  KIND_SPRITE_SHEET,
} from '@/lib/graph/image-outcomes/manifest';
import { STYLE_VOCAB, STYLE_PRESETS, isStylePreset, resolveStyle } from '@/lib/graph/image-outcomes/styles';
import {
  buildRenderInstructions,
  buildCharacterSheetInstructions,
} from '@/lib/graph/image-outcomes/instructions';
import { latestBoundSheet, nextSheetPath } from '@/lib/graph/image-outcomes/sheet-store';
import { buildLocalRenderParams } from '@/lib/graph/image-outcomes/local-render-params';
import { nextRenderPath, boundRenderMap } from '@/lib/graph/image-outcomes/render-store';
import sharp from 'sharp';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';
import { reskinManjiSvg, rasterSampler, analyzeSkin } from '@/lib/graph/polygonizer/skin-projection';
import { nextSkinPath, skinInputPath, latestSkin } from '@/lib/graph/polygonizer/skin-store';
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
 * Resolve `characters: [{ ref: 'sk_…' }]` entries on a sequential-art or
 * image-outcome manifest against stored character-sheet sketches — the
 * reuse seam: a character minted once (its own `sk_` ref, its own bound
 * sheet render) can be pulled into any comic page or single shot by ref.
 * The referenced sheet's character block is inlined (so the stored
 * manifest stays self-contained and deterministic) and the ref is kept
 * for provenance + bound-PNG lookup. Inline fields on the entry override
 * the sheet's (rename an id locally, trim outfits); pure-inline entries
 * pass through untouched.
 */
export function resolveCharacterRefs(manifest) {
  const castsCharacters = manifest?.kind === KIND_SEQUENTIAL_ART || manifest?.kind === KIND_IMAGE_OUTCOME;
  if (!castsCharacters || !Array.isArray(manifest.characters)) return manifest;
  const characters = manifest.characters.map((entry, i) => {
    if (!entry || typeof entry !== 'object' || !entry.ref || entry.description) return entry;
    const sheet = SketchRepository.getByRef(entry.ref);
    if (!sheet) {
      throw new Error(`characters[${i}]: character-sheet '${entry.ref}' not found — mint it via create_sketch { kind: 'character-sheet' } first`);
    }
    if (sheet.manifest?.kind !== KIND_CHARACTER_SHEET) {
      throw new Error(`characters[${i}]: '${entry.ref}' is kind '${sheet.manifest?.kind}', not a character-sheet`);
    }
    return { ...sheet.manifest.character, ...entry };
  });
  return { ...manifest, characters };
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
  let finalized;
  if (isImageOutcomesKind(manifest?.kind)) {
    // Image-outcomes kinds (director scaffolds for external image
    // generation) bypass the diagram pipeline — no recipe lowering, no
    // Rendrant expansion. The stored manifest is the normalized form so
    // the contract version, depth sort, and defaults are pinned at mint.
    try {
      finalized = normalizeImageOutcomesManifest(resolveCharacterRefs(manifest));
    } catch (err) {
      throw new Error(`Invalid manifest: ${err.message}`);
    }
    // Scene cohesion (load-bearing shared source): when a scene declares no
    // explicit plate style, the plate INHERITS the lead cast clip's style at
    // mint, so the background is painted in the same look as the characters —
    // "background watercolor = character watercolor" by construction, no check.
    if (finalized.kind === KIND_SCENE_MOTION && !finalized.renderBrief) {
      const lead = finalized.cast?.[0];
      // clipRef may be a keyframe SKETCH ref (sk_ or a custom ref) or a forged
      // motion (mo_, not in the sketch store). Look up the sketch; inherit its
      // style when present. A mo_ ref simply resolves to null and is skipped.
      if (lead && !/^mo_/i.test(lead.clipRef)) {
        const clipBrief = SketchRepository.getByRef(lead.clipRef)?.manifest?.renderBrief;
        if (clipBrief) {
          finalized = { ...finalized, renderBrief: clipBrief, plateStyleInheritedFrom: lead.clipRef };
        }
      }
    }
  } else {
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
  finalized = expanded;
  try {
    finalized = improveFloorplanManifest(expanded);
  } catch {
    finalized = expanded;
  }

  const { ok, errors } = validateSketchManifest(finalized);
  if (!ok) {
    throw new Error(`Invalid manifest:\n - ${errors.join('\n - ')}`);
  }
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

  // Beats guard rail (B9): a beats recipe is not an SVG manifest — routing it
  // through the sketch validator half-works for titles and hard-fails
  // confusingly on manifests. Teach the domain tool instead.
  const existingSketch = SketchRepository.getByRef(ref);
  if (existingSketch?.manifest && isBeatsKind(existingSketch.manifest.kind)) {
    throw new Error(
      `'${ref}' is a beats artifact (${existingSketch.manifest.kind}) — edit it with `
      + 'update_beats { ref, manifest?, title?, note? } (validated musically, and every edit '
      + 'snapshots a revision). Read it first with get_beats.',
    );
  }
  // Voice guard rail: a voice register is not an SVG manifest either — the
  // sketch validator would mangle it. Re-mint through the domain tool.
  if (existingSketch?.manifest && isVoiceRegisterKind(existingSketch.manifest.kind)) {
    throw new Error(
      `'${ref}' is a voice register — re-mint a variant with create_voice (read it first `
      + 'with get_voice; the capability manual is get_voice_vocab).',
    );
  }

  let nextManifest;
  if (manifest !== undefined && isImageOutcomesKind(manifest?.kind)) {
    // Image-outcomes kinds skip the diagram pipeline; store the normalized
    // form (same gate as mintSketch).
    try {
      nextManifest = normalizeImageOutcomesManifest(resolveCharacterRefs(manifest));
    } catch (err) {
      throw new Error(`Invalid manifest: ${err.message}`);
    }
  } else if (manifest !== undefined) {
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

const STYLE_AUTHOR_NOTE =
  'Presets are TEMPLATES, not a closed gate. Author a style on renderBrief three ways: '
  + '(1) preset (+ dials); (2) preset + overrides { style?, mood?, lighting?, lock:[extra lines], negative:[extra lines] } to FORK a template; '
  + '(3) a fully inline custom style { id, style, mood, lighting, lock:[...], negative:[...] } with no preset. '
  + 'Applying the SAME style to a scene’s cast clips and its plate is what makes the scene cohesive (the plate inherits the cast style by default).';

export async function getStyleVocabHandler(input) {
  const id = input && typeof input === 'object' ? input.id : undefined;
  if (id === undefined || id === null || id === '') {
    return {
      note: STYLE_AUTHOR_NOTE,
      presets: STYLE_PRESETS.map((p) => ({
        preset: p,
        name: STYLE_VOCAB[p].name,
        style: STYLE_VOCAB[p].style,
        dials: Object.keys(STYLE_VOCAB[p].dials),
      })),
    };
  }
  if (typeof id !== 'string') throw new Error('`id` must be a style preset name (string)');
  if (!isStylePreset(id)) {
    throw new Error(`No style preset '${id}'. Available: ${STYLE_PRESETS.join(', ')} (or author a custom style — see note).`);
  }
  const resolved = resolveStyle(id); // default dials
  return {
    preset: id,
    name: resolved.name,
    style: resolved.style,
    mood: resolved.mood,
    lighting: resolved.lighting,
    lock: resolved.lock,
    negative: resolved.negative,
    dials: STYLE_VOCAB[id].dials, // full dial spec (kinds, poles/values, defaults, bands/phrases)
    fork: STYLE_AUTHOR_NOTE,
  };
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

  // Beats guard rail (B9): geometry diffing two recipes produces a meaningless
  // picture — the musical diff is a report, not a picture.
  if ((left.manifest && isBeatsKind(left.manifest.kind)) || (right.manifest && isBeatsKind(right.manifest.kind))) {
    throw new Error(
      'These are beats artifacts — use diff_beats { refA, refB } (accepts ref@rev) for a '
      + 'structured musical diff: tempo/track/grid/progression changes, not SVG geometry.',
    );
  }
  if ((left.manifest && isVoiceRegisterKind(left.manifest.kind)) || (right.manifest && isVoiceRegisterKind(right.manifest.kind))) {
    throw new Error(
      'These are voice registers — compare them by reading both with get_voice: the recipes are '
      + 'two axes + a blend, small enough to diff by eye, not SVG geometry.',
    );
  }

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

// exportsBaseDir lives in ./exports-dir.js (shared with tools/beats.js);
// re-exported here for existing importers.
export { exportsBaseDir };

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
 */
export async function exportModelHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('export_model requires { ref }');
  }
  const { ref, write = true, format = 'glb', scale = 1 } = input;
  if (!ref || typeof ref !== 'string') {
    throw new Error('`ref` is required (string)');
  }
  if (typeof write !== 'boolean') {
    throw new Error('`write` must be a boolean if provided');
  }
  if (format !== 'glb' && format !== 'stl') {
    throw new Error("`format` must be 'glb' or 'stl' if provided");
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error('`scale` must be a positive number if provided');
  }
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) {
    throw new Error(`No sketch exists at ref '${ref}'`);
  }
  if (!sketch.manifest) {
    throw new Error(`Sketch '${ref}' has no manifest`);
  }

  const { payload, kind } = await resolveWorldScene(sketch);
  const exported = payload
    ? (format === 'stl'
      ? facesToStl(payload, { scale, generator: `mojulo ${ref}` })
      : facesToGlb(payload, { generator: `mojulo ${ref}` }))
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
    format,
    url,
    bytes: exported.byteLength,
    vertices: exported.vertexCount,
    triangles: exported.triangleCount,
  };
  if (format === 'glb') result.nodes = exported.nodeCount;
  else {
    // the print handoff is shape-only and unverified-manifold; say so in-band
    result.note =
      'STL is bare triangle soup for slicers: colour/groups dropped, water/decals omitted, '
      + 'repeats expanded, z-up, units read as mm (use `scale`). Not guaranteed manifold — '
      + "let the slicer's mesh repair union open shells on import.";
  }
  if (write) {
    const dir = exportsBaseDir();
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${ref}.${format}`);
    await fs.writeFile(file, exported.bytes);
    result.path = file;
  }
  return result;
}

/**
 * get_image_render_packet — the read half of the image-outcomes render
 * handoff (image-outcomes.plan.md I3): everything an external image-capable
 * worker (the Codex/GPT agent first) needs to paint a minted
 * image-outcome / sequential-art ref. Returns render instructions (built
 * from the manifest — camera/pose phrasings + Style Lock when a style
 * preset is set), the normalized manifest, and scaffold URLs (page + per-
 * panel crops). Read-only and stateless — the durable request queue and
 * `submit_image_render` are the gated remainder of I3; until they land the
 * worker hands its PNG back to the operator out of band.
 */
export async function getImageRenderPacketHandler(input) {
  const { ref, target } = input || {};
  if (!ref || typeof ref !== 'string') {
    throw new Error('get_image_render_packet requires { ref }');
  }
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (!isImageOutcomesKind(sketch.manifest?.kind)) {
    throw new Error(
      `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — not an image-outcome/sequential-art `
      + 'director packet. Mint one via create_sketch with those kinds (read the sketch_vocab cards).',
    );
  }
  const manifest = normalizeImageOutcomesManifest(sketch.manifest);
  const encoded = encodeURIComponent(sketch.ref || ref);
  const isKeyframe = manifest.kind === KIND_KEYFRAME_ANIMATION;
  const isScene = manifest.kind === KIND_SCENE_MOTION;
  const isSprite = manifest.kind === KIND_SPRITE_SHEET;
  const scaffoldUrls = (panelId) => {
    // A keyframe target's scaffold is that key's meru guide (the posed mannequin
    // between register lines) — the raster the worker paints OVER — plus the
    // per-key OpenPose skeleton as the structural (ControlNet) variant. A face
    // variant re-renders the SAME pose, so it shares the key's guide.
    if (isKeyframe) {
      const { keyIndex } = parseKeyframeTarget(panelId ?? 'key-0');
      return {
        pngUrl: `/api/sketches/${encoded}/png?inline=1&key=${keyIndex}`,
        controlPngUrl: `/api/sketches/${encoded}/png?inline=1&key=${keyIndex}&skeleton=1`,
      };
    }
    // A scene-motion target's scaffold is the STAGE GUIDE — the declared ground
    // plane (horizon + tick figures) the worker paints a background over. A
    // cross-cut shot's plate target serves that shot's OWN stage guide.
    if (isScene) {
      const t = panelId ?? 'plate';
      return { pngUrl: `/api/sketches/${encoded}/png?inline=1&plate=1&target=${encodeURIComponent(t)}` };
    }
    const panel = panelId ? `&panel=${encodeURIComponent(panelId)}` : '';
    return {
      svgUrl: `/api/sketches/${encoded}/svg?inline=1${panel}`,
      pngUrl: `/api/sketches/${encoded}/png?inline=1&scale=2${panel}`,
      // Geometry-only variant for structural conditioners (ControlNet):
      // labels and dashed boxes stripped so they can't be traced into the art.
      controlPngUrl: `/api/sketches/${encoded}/png?inline=1&scale=2&control=1${panel}`,
    };
  };

  // Targets mirror the manifest's render strategy (the I3 expansion rule,
  // shared with bind_image_render and the final composite).
  const targets = renderTargets(manifest);

  const resolvedTarget = target ?? targets[0];
  if (!targets.includes(resolvedTarget)) {
    throw new Error(
      `target '${resolvedTarget}' is not a render target of '${ref}' (targets for its `
      + `${manifest.kind === KIND_SEQUENTIAL_ART ? `'${manifest.renderStrategy}' strategy` : 'kind'}: ${targets.join(', ')})`,
    );
  }
  const panelId = resolvedTarget === 'page' ? undefined : resolvedTarget;

  const response = {
    ok: true,
    ref: sketch.ref || ref,
    kind: manifest.kind,
    title: manifest.title,
    ...(manifest.kind === KIND_SEQUENTIAL_ART ? { renderStrategy: manifest.renderStrategy } : {}),
    target: resolvedTarget,
    targets,
    // The step the spike showed workers skip: actually invoking image
    // generation. The scaffold is conditioning input, never the deliverable —
    // a worker that returns the wireframe has traced, not generated.
    workerProtocol: [
      ...(manifest.kind === KIND_CHARACTER_SHEET
        ? [
            '0. This target IS a character reference sheet — a reusable identity artifact. Generate it from `instructions` conditioned on the scaffold (the strip layout), then SUBMIT the PNG back via `bind_character_sheet { ref, image_path }` so mojulo can serve it as a conditioning reference to every future comic that casts this character.',
          ]
        : []),
      ...(manifest.characters?.length
        ? [
            '0. FIRST — before any panel or shot: for each entry in `characterSheets`, if it carries `boundSheet`, FETCH that PNG (`boundSheet.url` / `boundSheet.path`) and use it as the identity reference — do NOT regenerate that character. Otherwise generate the sheet from its `instructions` (neutral-light turnaround strip, one row per outfit) and, when the entry has a `ref`, submit the PNG via `bind_character_sheet { ref, image_path }` so it is saved for reuse. Condition every panel or shot featuring a character on that character\'s sheet, and return any newly generated sheets alongside the artwork.',
          ]
        : []),
      `1. Fetch the scaffold PNG (scaffold.pngUrl) — it is a wireframe control diagram, NOT the artifact.`,
      '2. INVOKE your image-generation capability, conditioning on the scaffold image with `instructions` as the prompt.',
      '3. Verify the output is a fully painted raster — no wireframe lines, flat colored polygons, stick figures, dashed boxes, or labels from the scaffold. If any survive, regenerate.',
      ...(manifest.kind === KIND_CHARACTER_SHEET
        ? ['4. Submit the sheet via `bind_character_sheet { ref, image_path }`.']
        : [
            `4. SUBMIT the generated PNG back via \`bind_image_render { ref: '${sketch.ref || ref}', target: '<this target>', image_path }\`. Once every target is bound, mojulo composites the finished page — borders, bubbles, and lettering re-imposed deterministically — at \`finalUrl\`, ready to publish (gather + cook comic).`,
          ]),
      ...(targets.length > 1
        ? [`5. Repeat for each remaining target: ${targets.filter((t) => t !== resolvedTarget).join(', ')}.`]
        : []),
    ],
    instructions: buildRenderInstructions(manifest, (isKeyframe || isScene) ? { target: resolvedTarget } : (panelId ? { panelId } : {})),
    // Deterministic head start for a diffusion-backend worker (ComfyUI et
    // al., local-render-worker.plan.md L1): compact prompt fragments,
    // negatives, ControlNet strength, and pixel size. The driving agent
    // appends its own beat/subject distillation before generating.
    localParams: buildLocalRenderParams(manifest, resolvedTarget),
    // Identity metadata: one reference-sheet brief per declared character.
    // A character carrying a `ref` points at a standalone character-sheet
    // sketch; when that sheet has a bound render, the PNG rides along as
    // `boundSheet` — the stored conditioning reference.
    ...(manifest.characters?.length
      ? {
          characterSheets: manifest.characters.map((c) => {
            const bound = c.ref ? latestBoundSheet(c.ref) : null;
            return {
              id: c.id,
              ...(c.name ? { name: c.name } : {}),
              ...(c.ref ? { ref: c.ref } : {}),
              outfits: c.outfits.map((o) => o.id),
              ...(bound
                ? { boundSheet: { n: bound.n, path: bound.path, url: `/api/sketches/${encodeURIComponent(c.ref)}/sheet.png` } }
                : {}),
              instructions: buildCharacterSheetInstructions(manifest, c.id),
            };
          }),
        }
      : {}),
    ...(manifest.kind === KIND_CHARACTER_SHEET
      ? (() => {
          const bound = latestBoundSheet(sketch.ref || ref);
          return bound
            ? { boundSheet: { n: bound.n, path: bound.path, url: `/api/sketches/${encoded}/sheet.png` } }
            : {};
        })()
      : {}),
    scaffold: scaffoldUrls(panelId),
    // Submitted-render bookkeeping: which targets already have a bound PNG
    // (latest n per target), and the composite URL once all are bound.
    ...(manifest.kind !== KIND_CHARACTER_SHEET
      ? (() => {
          const bound = boundRenderMap(sketch.ref || ref, targets);
          const boundTargets = Object.keys(bound);
          return {
            ...(boundTargets.length
              ? { boundRenders: Object.fromEntries(boundTargets.map((t) => [t, bound[t].n])) }
              : {}),
            // A keyframe animation / scene has no still `final.png` — the finished
            // artifact is a forge_motion `mo_` GIF/MP4 (keyframe: stitched from the
            // accepted cels; scene: composited from clips over the accepted plate).
            ...(boundTargets.length === targets.length
              ? (isKeyframe
                  ? { allCelsAccepted: true }
                  : isScene
                    ? { sceneReady: true }
                    // A sprite sheet has no still composite — the finished artifact
                    // is the baked pixelizer sprite payload. Point at the bake tool.
                    : isSprite
                      ? { spritesReady: true, bakeTool: 'bake_sprite_sheet' }
                      : { finalUrl: `/api/sketches/${encoded}/final.png` })
              : {}),
          };
        })()
      : {}),
    manifest,
  };
  if (panelId && !isKeyframe && !isScene) {
    // The page scaffold rides along with every panel target — the page
    // teaches layout and continuity, the crop teaches the local shot.
    response.pageScaffold = scaffoldUrls();
  }
  return response;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/**
 * bind_character_sheet — the submit half of the character-sheet loop:
 * the render worker (or the operator) hands back the generated sheet PNG
 * and it is snapshotted, append-only, into the sketch's outcome folder.
 * From then on every render packet for a comic casting this character
 * serves the PNG as `boundSheet` — the stored conditioning reference.
 */
export async function bindCharacterSheetHandler(input) {
  const { ref, image_path: imagePath, image_base64: imageBase64 } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('bind_character_sheet requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (sketch.manifest?.kind !== KIND_CHARACTER_SHEET) {
    throw new Error(
      `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — sheet renders bind to the character-sheet ref itself, not to a comic`,
    );
  }
  if ((imagePath ? 1 : 0) + (imageBase64 ? 1 : 0) !== 1) {
    throw new Error('bind_character_sheet requires exactly one of image_path | image_base64');
  }
  const bytes = imagePath ? await fs.readFile(imagePath) : Buffer.from(imageBase64, 'base64');
  if (bytes.length < 8 || !bytes.subarray(0, 4).equals(PNG_MAGIC)) {
    throw new Error('the submitted image is not a PNG (the sheet must be a generated raster, not the SVG scaffold)');
  }
  const slot = nextSheetPath(sketch.ref);
  await fs.writeFile(slot.path, bytes);
  return {
    ok: true,
    ref: sketch.ref,
    n: slot.n,
    path: slot.path,
    url: `/api/sketches/${encodeURIComponent(sketch.ref)}/sheet.png`,
    bytes: bytes.length,
  };
}

/**
 * get_skin_packet — the conversational skin handoff for a skinnable polygomer.
 * Carries the render-worker discipline as DATA (which scaffold to paint over,
 * the paint brief, how to submit, what comes next) so the driving agent needs
 * no memorized procedure — pull, paint what it asks, submit. The polygomer
 * analogue of get_image_render_packet.
 */
// Kinds whose control scaffold + skin projection ride the shared polygon
// contract (renderStoredSketchSvg control mode → reskinManjiSvg / world bake).
const SKINNABLE_KINDS = new Set(['manji-tree', 'figure', 'workbench', 'assembler']);
export async function getSkinPacketHandler(input) {
  const { ref } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('get_skin_packet requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (!SKINNABLE_KINDS.has(sketch.manifest?.kind)) {
    throw new Error(
      `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — get_skin_packet skins manji-tree polygomers (sketch_polygomer / create_manji_tree), workbench/assembler polygomers (create_workbench / create_assembler), or figures (create_figure)`,
    );
  }
  const encoded = encodeURIComponent(sketch.ref);
  const title = sketch.title || sketch.manifest.title || 'this polygomer';
  const bound = latestSkin(sketch.ref);
  return {
    ref: sketch.ref,
    kind: sketch.manifest.kind,
    title,
    scaffold: {
      url: `/api/sketches/${encoded}/png?control=1&inline=1&scale=2`,
      note: 'The FILLED lit-solid silhouette — paint your finished creature directly OVER this, matching its silhouette, proportions, and part layout. NOT the wireframe /svg (a wireframe fragments a diffusion skin into many objects).',
    },
    brief: `Paint a finished "${title}" over the scaffold: ONE coherent subject that keeps the scaffold's silhouette and massing. No wireframe / ring / dot / diagram language, no text.`,
    submit: `skin_polygomer({ ref: "${sketch.ref}", image_path })  — hand back the painted PNG; it projects onto the model's faces.`,
    then: sketch.manifest.kind === 'figure'
      ? `/api/sketches/${encoded}/skin.png — the figure wearing the skin deterministically (albedo × its own form shading). 3D world/glb bake for figures is a follow-up.`
      : `export_model({ ref: "${sketch.ref}" }) → /api/sketches/${encoded}/model.glb (portable turnable GLB, skin baked into the vertex colours). Live turntable: /api/sketches/${encoded}/world`,
    ...(bound ? { alreadySkinned: { n: bound.n, url: `/api/sketches/${encoded}/skin.png` } } : {}),
  };
}

/**
 * skin_polygomer — the polygomer WEARS a diffusion skin (skin-projection.js).
 * A `manji-tree` polygomer is built, its filled control scaffold
 * (`?control=1`) is painted over by the render worker, and the painted PNG is
 * handed back here. Because the skin was painted over the scaffold from a fixed
 * camera, it is already registered to the render in screen space: every filled
 * face samples the skin at its screen centroid → a DETERMINISTIC render that
 * wears the skin's colours, snapshotted append-only into the outcome folder.
 * The manji-tree recipe stays sovereign; the skin is a bound render.
 */
export async function skinPolygomerHandler(input) {
  const { ref, image_path: imagePath, image_base64: imageBase64 } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('skin_polygomer requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  if (!SKINNABLE_KINDS.has(sketch.manifest?.kind)) {
    throw new Error(
      `Sketch '${ref}' is kind '${sketch.manifest?.kind}' — skin_polygomer wears a skin on a manji-tree/workbench/assembler polygomer or a figure`,
    );
  }
  if ((imagePath ? 1 : 0) + (imageBase64 ? 1 : 0) !== 1) {
    throw new Error('skin_polygomer requires exactly one of image_path | image_base64');
  }
  const skinBytes = imagePath ? await fs.readFile(imagePath) : Buffer.from(imageBase64, 'base64');
  if (skinBytes.length < 8 || !skinBytes.subarray(0, 4).equals(PNG_MAGIC)) {
    throw new Error('the skin must be a PNG (the painted render over the ?control=1 scaffold, not the SVG)');
  }
  // The filled control scaffold the skin was painted over — the shared camera IS
  // the registration, so no UV unwrap is needed. The stored-sketch dispatcher
  // renders each kind's own control scaffold (manji-svg, figure-render, or the
  // workbench/assembler faces-scaffold) through the same polygon contract.
  const controlSvg = await renderStoredSketchSvg(sketch, { control: true });
  const { data, info } = await sharp(skinBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const raster = { data, width: info.width, height: info.height, channels: info.channels };
  // Background clamp: faces whose centroid misses the creature take the mean
  // skin colour instead of a stray background pixel (kills pale-edge dots).
  const { background, fallback } = analyzeSkin(raster);
  const sampler = rasterSampler({ ...raster, background, fallback });
  const { svg, faces } = reskinManjiSvg(controlSvg, sampler);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const slot = nextSkinPath(sketch.ref);
  await fs.writeFile(slot.path, png);
  // Keep the INPUT painted skin too, so the turnable /world + .glb model can
  // bake the same skin onto its 3D faces (export_model / the manji-tree world kind).
  await fs.writeFile(skinInputPath(sketch.ref, slot.n), skinBytes);
  return {
    ok: true,
    ref: sketch.ref,
    n: slot.n,
    faces,
    url: `/api/sketches/${encodeURIComponent(sketch.ref)}/skin.png`,
    path: slot.path,
    bytes: png.length,
  };
}

/**
 * bind_image_render — the submit half of the page/panel render loop
 * (plan I3's submit surface, minimal like bind_character_sheet): the
 * render worker hands back a generated PNG for one target of an
 * image-outcome / sequential-art sketch. Once every target from
 * `renderTargets` is bound, `/api/sketches/<ref>/final.png` composites
 * the finished page (I5) and the page is publishable via the comic cook.
 */
export async function bindImageRenderHandler(input) {
  const { ref, target, image_path: imagePath, image_base64: imageBase64 } = input || {};
  if (!ref || typeof ref !== 'string') throw new Error('bind_image_render requires { ref }');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`Sketch '${ref}' not found`);
  const kind = sketch.manifest?.kind;
  if (kind !== KIND_IMAGE_OUTCOME && kind !== KIND_SEQUENTIAL_ART) {
    throw new Error(
      kind === KIND_CHARACTER_SHEET
        ? `Sketch '${ref}' is a character-sheet — submit its render via bind_character_sheet`
        : `Sketch '${ref}' is kind '${kind}' — page/panel renders bind to image-outcome / sequential-art sketches`,
    );
  }
  const manifest = normalizeImageOutcomesManifest(sketch.manifest);
  const targets = renderTargets(manifest);
  const resolvedTarget = target ?? (targets.length === 1 ? targets[0] : null);
  if (!resolvedTarget || !targets.includes(resolvedTarget)) {
    throw new Error(
      `bind_image_render requires a valid target for '${ref}' (targets: ${targets.join(', ')})`,
    );
  }
  if ((imagePath ? 1 : 0) + (imageBase64 ? 1 : 0) !== 1) {
    throw new Error('bind_image_render requires exactly one of image_path | image_base64');
  }
  const bytes = imagePath ? await fs.readFile(imagePath) : Buffer.from(imageBase64, 'base64');
  if (bytes.length < 8 || !bytes.subarray(0, 4).equals(PNG_MAGIC)) {
    throw new Error('the submitted image is not a PNG (submit the generated raster, not the SVG scaffold)');
  }
  const slot = nextRenderPath(sketch.ref, resolvedTarget);
  await fs.writeFile(slot.path, bytes);
  const bound = boundRenderMap(sketch.ref, targets);
  const remaining = targets.filter((t) => !bound[t]);
  return {
    ok: true,
    ref: sketch.ref,
    target: resolvedTarget,
    n: slot.n,
    path: slot.path,
    bytes: bytes.length,
    remaining_targets: remaining,
    ...(remaining.length === 0
      ? { final_url: `/api/sketches/${encodeURIComponent(sketch.ref)}/final.png` }
      : {}),
  };
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
    name: 'get_style_vocab',
    description:
      "Read the STYLE presets — drawing-discipline templates (steamboat, tv-cartoon, louvrijks oil, ukiyo-e, photo-realism/'unreal-engine', …) that `renderBrief` locks on image / keyframe-animation / scene-motion sketches. Omit `id` to LIST; pass a preset to read it in full (Style Lock lines + dial specs). Presets are TEMPLATES: fork via `renderBrief.overrides`, or author a fully custom style inline (`{ id, style, mood, lighting, lock[], negative[] }`). Applying the SAME style to a scene's cast clips and its plate is what makes it cohesive. Read-only.",
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
    name: 'get_skin_packet',
    description:
      "Pull the SKIN packet for a `manji-tree`/`workbench`/`assembler` polygomer or a `figure` — the handoff to paint it into a finished model. Returns `{ ref, title, scaffold:{ url, note }, brief, submit, then, alreadySkinned? }`: `scaffold.url` is the FILLED control render to paint OVER (not the wireframe), `brief` is the one-line paint instruction, `submit` names the bind tool, `then` names the export. The whole procedure is DATA here — pull this, paint what `brief` says over `scaffold.url` with your image generator, then call `skin_polygomer`. No memorized rules needed. (The polygomer analogue of get_image_render_packet.)",
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'The manji-tree polygomer sketch ref (`sk_…`). Errors on other kinds.' },
      },
      required: ['ref'],
    },
    handler: getSkinPacketHandler,
  });

  registerTool({
    name: 'skin_polygomer',
    description:
      "Make a `manji-tree`/`workbench`/`assembler` polygomer — or a `figure` (create_figure) — WEAR a painted skin: the deterministic approximation of a diffusion render. Flow: build the model → pull its FILLED control scaffold (`/api/sketches/<ref>/png?control=1` — the lit solid silhouette, NOT the wireframe, which fragments a diffusion skin) → paint a finished subject OVER that scaffold with your image generator (keeping its silhouette + massing) → submit the painted PNG here with `image_path` (same-host file) or `image_base64`. Painted over the scaffold from the same camera, every face samples the skin at its screen position (no UV unwrap) → a deterministic render wearing the skin's colours at `/api/sketches/<ref>/skin.png`. The recipe stays the deliverable; the skin is a bound render/provenance. Single-view (front-facing); full wrap-around is the turntable multi-view bake. Returns `{ ok, ref, n, faces, url, path, bytes }`.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'The manji-tree polygomer sketch ref (`sk_…`). Errors on other kinds.',
        },
        image_path: {
          type: 'string',
          description: 'Absolute path to the painted skin PNG on this host (painted over the ?control=1 scaffold).',
        },
        image_base64: {
          type: 'string',
          description: 'Base64-encoded PNG bytes (fallback for remote workers). Exactly one of image_path | image_base64.',
        },
      },
      required: ['ref'],
    },
    handler: skinPolygomerHandler,
  });

  registerTool({
    name: 'export_model',
    description:
      "Export a stored sketch's traversable 3D World as a binary glTF (.glb) the operator can open in Blender, Unreal, three.js, or macOS Quick Look — turning a depiction into a portable asset rather than a walled view. Pass the sketch `ref`. Works for the World kinds (fractal cities, transportation hubs, subway interiors, painted-landscape terrain, workbench/assembler object studies, **`manji-tree` polygomers** — a `create_manji_tree` object is a turnable 3D model with no conversion step: the SAME ref serves `/world` and exports here, its bonded lathes lowered to baked faces, plus a `skin_polygomer` skin baked into the vertex colours — vehicle instances, the science views — molecule/atom/cell/field/fluid/ocean/mechanics/orbit — and furnished rooms); diagrams, charts, and CSS-3D-only turntables have no exportable geometry and return `{ ok:false, eligible:false }` with pointers to /scene and /svg. Fidelity: mojulo's lighting is BAKED into the geometry and the mesh is exported UNLIT (glTF KHR_materials_unlit + per-vertex colours), so it looks identical to the live World from any camera with no lighting setup downstream — the depiction is the asset, not a re-lightable PBR approximation. Camera-facing glow billboards and the sky dome are dropped (not geometry); gradient-painted faces collapse to a single colour; animated channels export at their static pose. Pass `format: 'stl'` for the 3D-PRINTING handoff instead: a binary STL for slicers (PrusaSlicer/Cura/Bambu) — shape only (colour/groups/textures deliberately dropped; water + ground decals omitted; instanced repeats expanded into real geometry; z-up as slicers expect), with `scale` mapping world units → millimetres. Honest triangle soup, not guaranteed-manifold — slicers repair open shells on import. Returns `{ ok, ref, kind, format, url, bytes, vertices, triangles }` (+ `nodes` for glb) plus, when `write` is true (the default), an on-disk `path` to the written file. The `url` (`/api/sketches/<ref>/model.glb` or `.stl`) regenerates the file deterministically on each request, so hand it to the operator for a browser download.",
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Existing sketch ref (`sk_…`) to export. Errors if no sketch with this ref exists.',
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
          default: 1,
          description:
            'STL only: multiply every coordinate on export. Slicers read STL units as millimetres, so this is the world-units → mm dial (e.g. 10 prints a 12-unit-tall figure at 120mm).',
        },
        write: {
          type: 'boolean',
          default: true,
          description:
            'When true (default), write the export to disk (under control/data/exports, or $MOJULO_EXPORTS_DIR) and return its `path` so the host agent can open or move the file. Set false to compute the export metadata + download URL without touching disk.',
        },
      },
      required: ['ref'],
    },
    handler: exportModelHandler,
  });
}
