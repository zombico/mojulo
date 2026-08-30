/**
 * Turntable strips — the gallery card that turns.
 *
 * A grid of models that all turn as the mouse sweeps across it is the cheapest
 * way for the surface to read as 3D. The mechanism is deliberately NOT a live
 * renderer per card: one PNG holding N azimuth frames side by side, stepped with
 * CSS `steps(N)`. No WebGL context per card, no iframe in the grid, one image
 * request — and the frames are baked by the SAME turntable camera path
 * `forge_motion` already drives (lib/motion/camera-path.js `orbitPath`).
 *
 * This module is PURE and import-light on purpose (only sketch-manifest, which
 * the gallery already imports): it is the single place that decides whether an
 * artifact turns, so the card, the route, and the mint-time warm can never
 * disagree. The bake itself lives in turntable-bake.js, server-side.
 *
 * Honesty rule, the same one §4's display modes enforce: an artifact that cannot
 * turn says so rather than pretending. A flow chart has no ¾ view; a beats track
 * has no picture at all. Both are answered here, by name.
 *
 * Design: components/3d-factory-ui.plan.md §6.
 */

import { sketchRenderMode } from './sketch-manifest';

/** Frames in one full 360° turn. 16 is the plan's number: enough to read as rotation, small enough to bake in one browser session. */
export const TURNTABLE_FRAMES = 16;
/** Per-frame cell. 4:3, small — a 16-cell strip is ~4096px wide and a few hundred KB. */
export const TURNTABLE_CELL = { width: 256, height: 192 };
/** Playback rate. 16 frames at 24fps = a 667ms turn. */
export const TURNTABLE_FPS = 24;
/**
 * The frame shown at rest — and under `prefers-reduced-motion`, where the card
 * never turns at all. Frame 0 of `orbitPath` IS the world's base shot, which
 * `deriveBaseShot` takes from the world's own authored `cameras[0]` when it has
 * one and otherwise from a ¾ orbit of the bounding box. So the rest frame is
 * either the author's hero shot or the ¾ the plan asks for, by construction —
 * the reduced-motion fallback is not a downgrade and nothing has to choose it.
 */
export const TURNTABLE_REST_FRAME = 0;

/**
 * Render modes with a real orbit. Both resolve a three.js World payload through
 * `resolveWorldScene`, so the bake path is uniform across them — walkable worlds
 * (cities, hubs, dungeons) and orbit-only objects (workbenches, assemblers, the
 * science/education views) alike.
 */
const TURNABLE_RENDER_MODES = new Set(['world', 'scene']);

/** Render modes whose card still is a cheap vector — no Chromium in the path. */
const VECTOR_STILL_MODES = new Set(['svg', 'diagram']);

/**
 * What a card should show for one artifact.
 *
 * @param {object}  args
 * @param {object}  args.manifest  the stored sketch manifest
 * @param {string}  args.ref       the sketch ref (used to build the srcs)
 * @param {number} [args.frames]   frame count (defaults to TURNTABLE_FRAMES)
 * @returns {?{
 *   renderMode: string, turns: boolean, reason: ?string,
 *   still: ?string, strip: ?string,
 *   frames: number, cell: {width:number,height:number}, fps: number, durationMs: number,
 * }} null only when there is no artifact to describe
 */
export function resolveTurntable({ manifest, ref, frames = TURNTABLE_FRAMES } = {}) {
  if (!manifest || typeof manifest !== 'object' || !ref) return null;
  const renderMode = sketchRenderMode(manifest);
  const r = encodeURIComponent(ref);
  const turns = TURNABLE_RENDER_MODES.has(renderMode);

  // The still is what the card shows before anyone asks it to turn, and it is
  // always something the server can produce cheaply: a vector kind rasterizes in
  // the browser straight off /svg, and a 3D kind reads the scale-1 PNG that
  // scene-png-warm has already baked into the disk cache at mint time.
  const still = VECTOR_STILL_MODES.has(renderMode)
    ? `/api/sketches/${r}/svg?inline=1`
    : turns
      ? `/api/sketches/${r}/png?inline=1&scale=1`
      : null;

  return {
    renderMode,
    turns,
    // Named, not silent: 'flat' is an artifact with a picture but no third axis
    // (a diagram, a scaffold); 'noStill' is one with no picture at all (beats is
    // heard, voice is spoken, a game is played, a motion comic is clicked).
    reason: turns ? null : still ? 'flat' : 'noStill',
    still,
    strip: turns ? `/api/sketches/${r}/turntable.png` : null,
    frames,
    cell: TURNTABLE_CELL,
    fps: TURNTABLE_FPS,
    durationMs: Math.round((frames / TURNTABLE_FPS) * 1000),
  };
}

/** Whether an artifact has an orbit to bake. The server's gate; same answer as `resolveTurntable().turns`. */
export function isTurnable(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  return TURNABLE_RENDER_MODES.has(sketchRenderMode(manifest));
}

/** Pixel size of the baked strip: N cells laid left to right in one row. */
export function stripSize(frames = TURNTABLE_FRAMES, cell = TURNTABLE_CELL) {
  return { width: cell.width * frames, height: cell.height };
}

/**
 * The `background-position-x` the strip animation ends on — and the one piece of
 * arithmetic here worth stating, because the obvious value (100%) is wrong.
 *
 * A percentage background-position aligns the image's p% point with the box's
 * p% point, so for an N-cell strip in a 1-cell box, position p lands on frame
 * `p·(N−1)/100`. Ending at 100% therefore steps through fractions of a cell and
 * every frame but the first and last is misaligned. Ending at `100·N/(N−1)`
 * makes `steps(N)` land on exactly frames 0…N−1, whole cells, no duplicate cell
 * baked into the strip to paper over it.
 */
export function stripEndPercent(frames = TURNTABLE_FRAMES) {
  return (frames / (frames - 1)) * 100;
}

/** The CSS custom properties one turning card needs. Keeps the algebra above out of the component. */
export function stripStyleVars({ frames = TURNTABLE_FRAMES, durationMs } = {}) {
  return {
    '--turn-frames': String(frames),
    '--turn-end': `${stripEndPercent(frames)}%`,
    '--turn-duration': `${durationMs ?? Math.round((frames / TURNTABLE_FPS) * 1000)}ms`,
  };
}
