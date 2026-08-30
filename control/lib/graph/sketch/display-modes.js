/**
 * Display modes — the one segmented control every artifact carries.
 *
 * Four ways to look at the same recipe, in ascending order of how much of the
 * pixel mojulo itself owns:
 *
 *   wire     — construction lines. mojulo's geometry, undressed.
 *   shaded   — vertex colours / procedural materials. mojulo's own paint.
 *   baked    — Blender Cycles GI baked INTO those vertex colours. mojulo's
 *              geometry, the operator's Blender, zero runtime cost.
 *   painted  — an external image worker over the scaffold. NOT mojulo's paint,
 *              and flagged as such wherever it renders (docs/bicycles.md).
 *
 * This module is PURE and import-free on purpose: it is the single place that
 * decides which modes an artifact actually has, so the detail page and the
 * gallery preview can never disagree about it. Callers supply the two facts
 * that live outside the manifest (`giVariantRef`, `hasBoundRender`); everything
 * else is read off the manifest.
 *
 * A mode is never silently hidden. An artifact without a GI bake still shows a
 * disabled `baked` button carrying `reason: 'noBake'` — "no bake yet, ask the
 * agent for one" is a better empty state than a button that isn't there.
 *
 * Design: components/3d-factory-ui.plan.md §4.
 */

import { sketchRenderMode } from './sketch-manifest';

export const DISPLAY_MODES = ['wire', 'shaded', 'baked', 'painted'];

/** Kinds whose finished form is painted by an external worker, not by mojulo. */
const PAINTED_KINDS = new Set(['image-outcome', 'sequential-art', 'cover']);

/**
 * Render modes that carry a display-mode control at all. Beats are heard, voice
 * is spoken, a game is played, a motion-comic is clicked through — none of them
 * has a "look at it four ways" axis, so they get no control rather than a row of
 * four disabled buttons.
 */
const CONTROLLED_RENDER_MODES = new Set(['world', 'scene', 'svg', 'diagram']);

/**
 * Which modes an artifact actually has.
 *
 * @param {object}  args
 * @param {object}  args.manifest       the stored sketch manifest
 * @param {string}  args.ref            the sketch ref (used to build view srcs)
 * @param {?string} args.giVariantRef   ref of a `<ref>_gi` bake variant, if one was minted
 * @param {boolean} args.hasBoundRender whether any external render is bound to this ref
 * @returns {?{ modes: Array, defaultMode: string }} null when this kind carries no control
 */
export function resolveDisplayModes({ manifest, ref, giVariantRef = null, hasBoundRender = false } = {}) {
  if (!manifest || typeof manifest !== 'object') return null;
  const renderMode = sketchRenderMode(manifest);
  if (!CONTROLLED_RENDER_MODES.has(renderMode)) return null;

  const kind = manifest.kind;
  // The bake stamp the drivetrain writes back (bake-world-gi.mjs). `inline-faces`
  // recoloured this world's OWN faces, so the sketch you are looking at IS the
  // bake and there is no unlit variant kept to switch back to; `generated-mesh`
  // minted a separate `<ref>_gi`, so both readings still exist.
  const bakedInPlace = manifest.giBake?.adapter === 'inline-faces';

  const wire = wireView(renderMode, ref);
  const shadedView = baseView(renderMode, ref);

  const modes = [
    {
      key: 'wire',
      available: Boolean(wire),
      reason: wire ? null : 'noWireframe',
      view: wire,
    },
    {
      key: 'shaded',
      // A baked-in-place world has no unlit reading to return to. Say so, rather
      // than offering a button that silently shows the baked render again.
      available: !bakedInPlace,
      reason: bakedInPlace ? 'bakedInPlace' : null,
      view: bakedInPlace ? null : shadedView,
    },
    {
      key: 'baked',
      available: bakedInPlace || Boolean(giVariantRef),
      reason: bakedInPlace || giVariantRef ? null : 'noBake',
      view: bakedInPlace ? shadedView : giVariantRef ? baseView(renderMode, giVariantRef) : null,
    },
    {
      key: 'painted',
      available: PAINTED_KINDS.has(kind) && hasBoundRender,
      reason: !PAINTED_KINDS.has(kind) ? 'notPaintable' : hasBoundRender ? null : 'noPaintedRender',
      // Never mojulo's paint — the badge on this one is not decoration.
      external: true,
      view: PAINTED_KINDS.has(kind) && hasBoundRender
        ? { kind: 'img', src: `/api/sketches/${encodeURIComponent(ref)}/final.png` }
        : null,
    },
  ];

  const defaultMode = bakedInPlace ? 'baked' : 'shaded';
  return { modes, defaultMode };
}

/** The plain, undressed reading — this is what the page renders today. */
function baseView(renderMode, ref) {
  const r = encodeURIComponent(ref);
  if (renderMode === 'world' || renderMode === 'scene') {
    return { kind: 'iframe', src: `/api/sketches/${r}/${renderMode}` };
  }
  if (renderMode === 'svg') return { kind: 'img', src: `/api/sketches/${r}/svg?inline=1` };
  return { kind: 'diagram', wireframe: false };
}

/**
 * The wireframe reading, where one exists. Both are capabilities the codebase
 * already had and simply never surfaced: `/world` has taken `?wire=1` all along,
 * and CreationMap has taken `mode="wireframe"`. /scene and /svg have no
 * construction reading, so they honestly report none.
 */
function wireView(renderMode, ref) {
  if (renderMode === 'world') {
    return { kind: 'iframe', src: `/api/sketches/${encodeURIComponent(ref)}/world?wire=1` };
  }
  if (renderMode === 'diagram') return { kind: 'diagram', wireframe: true };
  return null;
}

/** The mode to show, falling back to the default when `wanted` isn't available. */
export function pickMode(resolved, wanted) {
  if (!resolved) return null;
  const hit = resolved.modes.find((m) => m.key === wanted && m.available);
  if (hit) return hit;
  return resolved.modes.find((m) => m.key === resolved.defaultMode) || null;
}
