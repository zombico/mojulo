/**
 * Sketch summaries — the list row that leaves the manifest at home.
 *
 * A stored recipe can be a few hundred bytes (a science view) or several MB (a
 * `controllable` world carrying its baked `faces`). A gallery row draws a title,
 * a still that turns, and a handful of badges; it never needs the recipe, and a
 * shelf of three hundred of them must not pay for it. So `GET /api/sketches`
 * ships SUMMARIES: the identity columns, the server-derived `renderMode` and
 * effective `bucket`, and exactly the small facts the shelves read.
 *
 * ── The one rule about `manifest` ────────────────────────────────────────────
 * A summary carries `manifest` only when the client renders FROM the recipe:
 *   · `renderMode === 'diagram'` — CreationMap draws the manifest itself (flows,
 *     charts, kind-less diagrams). These rows are small.
 *   · effective bucket `voice` — the voice shelf's register card reads the whole
 *     recipe (bank, axes, direction). A register is a few hundred bytes.
 * Every other kind renders through a by-ref endpoint (/svg, /world, /scene,
 * /beats, /game, /png) and fetches `/api/sketches/<ref>` on the rare occasion it
 * needs the recipe (the board room's outliner, "save as new").
 *
 * The helpers at the bottom read BOTH shapes — a summary and a full sketch — so a
 * component fed either (the gallery vs the detail page) asks one question.
 *
 * This module is pure and client-safe: it imports only sketch-manifest, which
 * every gallery surface already carries.
 */

import { sketchRenderMode } from './sketch-manifest';

/** Whether a summary for this row keeps its manifest (see the rule above). */
export function summaryKeepsManifest({ renderMode, bucket } = {}) {
  return renderMode === 'diagram' || bucket === 'voice';
}

/**
 * The badge facts, off a parsed manifest. The same five the floor's strips and
 * the library rooms already read; nothing speculative.
 *   seed      — shown in the room modals
 *   giBake    — a GI bake is stamped on this recipe (badge)
 *   giAdapter — 'inline-faces' | 'generated-mesh' | null (display modes: a
 *               baked-in-place world has no unlit reading to return to)
 *   game      — the recipe carries a game binding (badge)
 *   audio     — the recipe carries an audio channel (badge)
 */
export function factsFromManifest(manifest) {
  const m = manifest && typeof manifest === 'object' ? manifest : {};
  return {
    seed: m.seed ?? null,
    giBake: Boolean(m.giBake),
    giAdapter: typeof m.giBake?.adapter === 'string' ? m.giBake.adapter : null,
    game: Boolean(m.game),
    audio: Boolean(m.audio),
  };
}

/**
 * A full sketch (rowToSketch shape) → its summary. The server's repository
 * builds summaries without parsing big manifests; this is the reference
 * projection for a row that IS already parsed (tests, the `recent` head), and
 * the single statement of the wire shape.
 */
export function summarizeSketch(sketch) {
  if (!sketch) return null;
  const manifest = sketch.manifest;
  const kind = typeof manifest?.kind === 'string' && manifest.kind ? manifest.kind : null;
  const renderMode = manifest ? sketchRenderMode(manifest) : null;
  const summary = {
    ref: sketch.ref,
    title: sketch.title,
    kind,
    renderMode,
    bucket: sketch.bucket,
    bucketOverride: sketch.bucketOverride ?? null,
    createdAt: sketch.createdAt,
    folderRef: sketch.folderRef ?? null,
    facts: factsFromManifest(manifest),
  };
  if (summaryKeepsManifest(summary)) summary.manifest = manifest;
  return summary;
}

/* ── dual-shape readers ───────────────────────────────────────────────────── */

/** The render mode: the server's word when present, else derived from the manifest. */
export function renderModeOf(sketch) {
  if (!sketch) return null;
  if (typeof sketch.renderMode === 'string') return sketch.renderMode;
  return sketch.manifest ? sketchRenderMode(sketch.manifest) : null;
}

/** The kind: the summary's column when present, else the manifest's. */
export function kindOf(sketch) {
  if (!sketch) return null;
  if (sketch.kind !== undefined) return sketch.kind ?? null;
  const kind = sketch.manifest?.kind;
  return typeof kind === 'string' && kind ? kind : null;
}

/** The badge facts: the summary's when present, else read off the manifest. */
export function factsOf(sketch) {
  if (sketch?.facts && typeof sketch.facts === 'object') return sketch.facts;
  return factsFromManifest(sketch?.manifest);
}
