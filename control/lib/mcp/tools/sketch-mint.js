/**
 * Split out of tools/sketches.js — see
 * lite-template/integration/_0828/mojulo-2.0-pure-creative.plan.md (Phase 1c).
 * sketches.js hosted six unrelated tool families in one 2038-line file; each
 * now owns its own module and sketches.js is the registration surface.
 */
// The MINT core — authored manifest → stored sketch. mintSketch is the one
// place input becomes truth, and its three branches (motion-comic /
// image-outcomes / the default recipe→diagram→expansion pipeline) are pinned
// byte-for-byte by sketches.mint-golden.test.js.


import path from 'node:path';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { isBeatsKind } from '@/lib/graph/beats/beats-manifest';
import { isVoiceRegisterKind } from '@/lib/graph/voice/voice-register';
import { validateGameManifest, normalizeGameManifest } from '@/lib/graph/game/game-manifest';
import { resolveGame } from '@/lib/graph/game/game-resolve';
import { auditLevel } from '@/lib/graph/game/game-audit';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { WORLD_KINDS } from '@/lib/graph/worlds/world-kinds';
import { planWorkbench, persistedLedger } from '@/lib/graph/worlds/workbench';
import { SketchRevisionRepository, REVISIONED_KINDS } from '@/lib/db/repositories/sketch-revisions';
import {
  validateSketchManifest,
  expandGridLayout,
  expandBoundaries,
  lowerDiagramKinds,
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
import {
  isMotionComicKind,
  normalizeMotionComicManifest,
  resolveMotionComicLayout,
  validateMotionComicRefs,
} from '@/lib/graph/motion-comic/motion-comic-manifest';
import { improveFloorplanManifest } from '@/lib/graph/polygonizer/floorplan-bim.js';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';
import {
  classifyPromptForCards,
  polygonizePrompt,
  resolvePolygonizerModelConfig,
  withConstellationGrid,
  lowerRecipeManifest,
  recipeFamilyAllowlist,
  buildPolygonizerSystemPrompt,
  buildPolygonizerUserPrompt,
  buildPolygonizerPlanningSystemPrompt,
  buildPolygonizerSkinSystemPrompt,
  buildSkinTurnUserPrompt,
  POLYGONIZER_SCHEMA,
  POLYGONIZER_PLANNING_SCHEMA,
  finalizeAgentManifest,
  finalizePlanningManifest,
} from '@/lib/graph/polygonizer/index.js';

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
  if (isMotionComicKind(manifest?.kind)) {
    // Motion comics (the click-gated presentation, motion-comic.plan.md)
    // bypass the diagram pipeline like image-outcomes kinds: the stored
    // manifest is the normalized fold document. Refs and page bubbleZones are
    // resolved against the store at mint — a dangling source or empty zone is
    // a mint error, never a play-time one.
    try {
      finalized = normalizeMotionComicManifest(manifest);
      // Slot placements get concrete rects here (layout × source aspect),
      // pinned into the stored manifest like every other mint-time default.
      finalized = resolveMotionComicLayout(finalized, (r) => SketchRepository.getByRef(r));
      validateMotionComicRefs(finalized, (r) => SketchRepository.getByRef(r));
    } catch (err) {
      // Error-as-drawer: a failed mint points at the kind's manifest manual.
      throw new Error(`Invalid manifest: ${err.message} — manifest manual: get_sketch_vocab({ id: 'motion-comic' }).`);
    }
  } else if (isImageOutcomesKind(manifest?.kind)) {
    // Image-outcomes kinds (director scaffolds for external image
    // generation) bypass the diagram pipeline — no recipe lowering, no
    // Rendrant expansion. The stored manifest is the normalized form so
    // the contract version, depth sort, and defaults are pinned at mint.
    try {
      finalized = normalizeImageOutcomesManifest(resolveCharacterRefs(manifest));
    } catch (err) {
      // Error-as-drawer: the card id IS the kind for the image-outcomes family.
      throw new Error(`Invalid manifest: ${err.message} — manifest manual: get_sketch_vocab({ id: '${manifest?.kind}' }).`);
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
  // Lower the diagram kinds (sequence / gantt / swimlanes) to plain marks before
  // grid/Rendrant expansion. Each step no-ops unless its trigger is present. This
  // is the SAME kernel lowering mint_diagram runs, so both stay bound.
  try {
    working = lowerDiagramKinds(working);
  } catch (err) {
    throw new Error(`Invalid manifest: ${err.message} — manifest manual: semantic_search({ kinds: ['sketch_vocab'], query: '<your kind or ask>' }); read a card in full via get_sketch_vocab({ id }).`);
  }
  // Resolve any grid `cell` placements to concrete x/y/w/h before validating
  // and storing, so the renderer only ever sees absolute coords.
  let expanded;
  try {
    // expandBoundaries runs after grid resolution (it wraps stations by their
    // resolved coords) and before Rendrant (boundary marks are inert to it).
    expanded = expandNeoRembrandt(withConstellationGrid(expandBoundaries(expandGridLayout(working))));
  } catch (err) {
    throw new Error(`Rendrant expansion error: ${err.message}`);
  }
  // House plans are graded + auto-improved at authoring time (a no-op for every other kind):
  // pick the best-scoring seed / cut a door into a stranded room. The grade itself is NOT
  // stored: it is derived, `gradeFloorplanManifest` recomputes it from the recipe on demand,
  // and storing it made the manifest hash move when the grader did (the lounge carried two
  // hashes for one room, 2026-09-08). The render path stays pure (it just regenerates this
  // manifest). Grading must never block minting, so fall back on any error.
  finalized = expanded;
  try {
    const { quality: _grade, ...improved } = improveFloorplanManifest(expanded);   // grade computed for selection, never stored
    finalized = improved;
  } catch {
    finalized = expanded;
  }

  const { ok, errors } = validateSketchManifest(finalized);
  if (!ok) {
    // Error-as-drawer (pointer discipline): a bare validator string leaves the
    // agent guessing which drawer resolves it — name the read explicitly.
    throw new Error(
      `Invalid manifest:\n - ${errors.join('\n - ')}\n`
      + `— manifest manual: semantic_search({ kinds: ['sketch_vocab'], query: '<your kind or ask>' }); read a card in full via get_sketch_vocab({ id }).`,
    );
  }
  }

  const sketch = SketchRepository.create({ title, manifest: finalized, ref, folderRef: folderRef ?? null, bucket: bucket ?? null });

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
  const { ref, title, manifest, folder_ref: folderRef, bucket, note } = input;
  if (!ref || typeof ref !== 'string') {
    throw new Error('`ref` is required (string)');
  }
  if (note !== undefined && (typeof note !== 'string' || !note.trim())) {
    throw new Error('`note` must be a non-empty string if provided');
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
  let gameNote;
  let workbenchStats = null;
  if (manifest !== undefined && manifest?.kind === 'game') {
    // Game recipes are not stations/marks diagrams either (edit-3d-recipes.plan.md
    // Phase 1) — the diagram fallback demanded viewBox from a game manifest, so
    // tweaking a level list or difficulty meant re-minting + re-binding project
    // membership. Pay the same STRUCTURAL gate as create_game: schema validation,
    // then resolveGame (every level exists + carries a `game` channel + its
    // contract fits THIS store), then the pure per-level contract dry-run.
    // COMPLETABILITY stays mint-time promotion discipline — evidence rides
    // create_game's audits/auto_audit params, which this generic surface doesn't
    // carry; level refs newly added by the edit are recorded in the result as
    // unaudited instead of silently passing the gate.
    try {
      const { ok, errors } = validateGameManifest(manifest);
      if (!ok) throw new Error(errors.join('; '));
      const levelSrc = (r) => `/api/sketches/${encodeURIComponent(r)}/world`;
      const { manifest: finalized, levels: resolved } = resolveGame(manifest, (r) => SketchRepository.getByRef(r), levelSrc);
      const reports = await Promise.all(resolved.map((lv) => auditLevel({
        ref: lv.ref, store: finalized.store, contract: lv.contract, allowUnaudited: true,
      })));
      const blocked = reports.filter((a) => !a.promotable);
      if (blocked.length) {
        throw new Error(blocked.map((a) => `${a.ref}: ${!a.dryRun.ok ? a.dryRun.errors.join('; ') : a.reason}`).join('\n - '));
      }
      const priorRefs = new Set(
        Array.isArray(existingSketch?.manifest?.levels)
          ? existingSketch.manifest.levels.map((l) => l && l.ref).filter(Boolean)
          : [],
      );
      const added = finalized.levels.map((l) => l.ref).filter((r) => !priorRefs.has(r));
      if (added.length) {
        gameNote = `level(s) added without completability evidence: ${added.join(', ')} — the mint-time gate `
          + '(create_game audits/auto_audit) did not see them; prove each with a forge_motion traversal when it matters.';
      }
      nextManifest = normalizeGameManifest(finalized);
    } catch (err) {
      throw new Error(
        `Invalid game manifest: ${err.message}\n— store-schema manuals: get_game_vocab() `
        + '(slices: character | inventory | party | progression | flags; events: typed-events).',
      );
    }
  } else if (manifest !== undefined && isMotionComicKind(manifest?.kind)) {
    // Same gate as mintSketch — update is the accrete-cheaply surface, so it
    // pays the same normalization + store checks.
    try {
      nextManifest = normalizeMotionComicManifest(manifest);
      nextManifest = resolveMotionComicLayout(nextManifest, (r) => SketchRepository.getByRef(r));
      validateMotionComicRefs(nextManifest, (r) => SketchRepository.getByRef(r));
    } catch (err) {
      // Error-as-drawer: a failed update points at the kind's manifest manual.
      throw new Error(`Invalid manifest: ${err.message} — manifest manual: get_sketch_vocab({ id: 'motion-comic' }).`);
    }
  } else if (manifest !== undefined && isImageOutcomesKind(manifest?.kind)) {
    // Image-outcomes kinds skip the diagram pipeline; store the normalized
    // form (same gate as mintSketch).
    try {
      nextManifest = normalizeImageOutcomesManifest(resolveCharacterRefs(manifest));
    } catch (err) {
      // Error-as-drawer: the card id IS the kind for the image-outcomes family.
      throw new Error(`Invalid manifest: ${err.message} — manifest manual: get_sketch_vocab({ id: '${manifest?.kind}' }).`);
    }
  } else if (
    manifest !== undefined && typeof manifest?.kind === 'string' && WORLD_KINDS[manifest.kind]
    && manifest.kind !== 'floorplan' && manifest.kind !== 'restaurant'
  ) {
    // World recipes are not stations/marks diagrams (0813 persona sims: the diagram
    // validator demanded viewBox/stations from a world manifest, so iterating a world
    // meant minting near-duplicate refs). Validate by RESOLVING through the world
    // registry — the render contract itself, including the fog/audio/game channels —
    // so an update can't store a world whose /world link then fails. floorplan/
    // restaurant stay on the diagram path: validateSketchManifest kind-dispatches
    // them and improveFloorplanManifest is their established update grader.
    // continuous-guardrails.plan.md G1: the workbench kind (including the code door, which
    // stores kind:'workbench' + program) pays the SAME gates on an edit it paid at mint — the
    // monomer validators, the material whitelist, the closure lint (advisory, rides
    // stats.warnings), the ledger. Before this the checks ran once: the edit path only asked
    // "does it lower", so a bad material or a malformed spec slipped through on iteration.
    if (manifest.kind === 'workbench') {
      try {
        workbenchStats = planWorkbench(manifest).stats;
      } catch (err) {
        throw new Error(`Invalid world manifest (kind 'workbench'): ${err.message}`);
      }
    }
    try {
      await resolveWorldScene({ ref, title: title ?? existingSketch?.title ?? 'world', manifest });
    } catch (err) {
      throw new Error(`Invalid world manifest (kind '${manifest.kind}'): ${err.message}`);
    }
    // G6: the ledger travels — re-stamped on every edit from THIS plan, never copied forward.
    nextManifest = workbenchStats ? { ...manifest, ledger: persistedLedger(workbenchStats.ledger) } : manifest;
  } else if (manifest !== undefined) {
    let expanded;
    try {
      expanded = expandNeoRembrandt(withConstellationGrid(expandGridLayout(manifest)));
    } catch (err) {
      throw new Error(`Rendrant expansion error: ${err.message}`);
    }
    let finalized = expanded;
    try {
      const { quality: _grade, ...improved } = improveFloorplanManifest(expanded);   // auto-improve floorplans, grade not stored; no-op otherwise
      finalized = improved;
    } catch {
      finalized = expanded;
    }
    const { ok, errors } = validateSketchManifest(finalized);
    if (!ok) {
      // Error-as-drawer (pointer discipline): same as the mint path.
      throw new Error(
        `Invalid manifest:\n - ${errors.join('\n - ')}\n`
        + `— manifest manual: semantic_search({ kinds: ['sketch_vocab'], query: '<your kind or ask>' }); read a card in full via get_sketch_vocab({ id }).`,
      );
    }
    nextManifest = finalized;
  }

  // G5 (cad-aid C2): the solid kinds keep a revision history. The PREVIOUS manifest is archived
  // before the overwrite — rev 1 is the mint manifest, written lazily at the first edit (no mint
  // site changes); the sketches row stays HEAD, the beats posture verbatim.
  let revision = null;
  if (nextManifest !== undefined && existingSketch?.manifest && REVISIONED_KINDS.has(existingSketch.manifest.kind)) {
    const archived = SketchRevisionRepository.append({ ref, manifest: existingSketch.manifest, note: note ?? null });
    revision = { archived_rev: archived.rev, head_rev: archived.rev + 1 };
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
    ...(gameNote ? { note: gameNote } : {}),
    ...(workbenchStats ? { stats: workbenchStats } : {}),
    ...(revision ? { revision } : {}),
  };
}
