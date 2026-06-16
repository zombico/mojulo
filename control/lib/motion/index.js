/**
 * Motion — the means to put a mojulo subject in motion and render it to an
 * animated artifact. Pure pipeline (no fs, no db): subject manifest + a shot
 * spec → N frame SVGs + a self-contained flipbook SVG + metadata. The MCP tool
 * (forge_motion) wraps this to encode a GIF and persist the resource group.
 *
 * Phase 1 ships the subject-agnostic CAMERA motions (turntable, orbit, push_in,
 * dolly_zoom, flythrough) over any manji-tree subject. Performance motions
 * (walk / grow / bounce — bound to specific primitives) land in Phase 2 behind
 * the same schema. See lite-template/integration/0609/motion-as-mcp-concern.plan.md.
 */

import { CAMERA_MOTIONS, cameraPathFor } from './camera-path.js';
import { chooseViewBox, renderSubjectFrames, stillFrameSvg } from './frame-render.js';
import { composeFlipbook } from './flipbook.js';

export { CAMERA_MOTIONS } from './camera-path.js';
export { encodeGif } from './encode-gif.js';
export { encodeStitchMp4, planClip, STITCH_WARN_FRAMES, STITCH_WARN_SECONDS } from './encode-mp4.js';
export { resolveFfmpeg } from './ffmpeg.js';
export { renderDeckMotion, DECK_MOTIONS, DECK_MOTION_NAMES, isDeckMotion, DECK_BG } from './deck.js';
export { expandSlide, hasReveals } from './reveal.js';
export { applyEntrance, ENTRANCES, isEntrance } from './interpolate.js';
export { renderRegimeA, hasAnimate } from './regime-a.js';
export { compileMotionCss, markBounds } from './css-motion.js';

export const MOTION_NAMES = Object.keys(CAMERA_MOTIONS);

const DEFAULT_FRAMES = { turntable: 24, orbit: 18, push_in: 24, dolly_zoom: 24, flythrough: 36 };

/**
 * Render a motion to frame SVGs + a flipbook.
 *
 * @param {object} args
 * @param {object} args.manifest      a manji-tree subject manifest
 * @param {string} args.motion        one of MOTION_NAMES
 * @param {object} [args.params]      per-motion params (from/to, end_scale, keyframes, fov, width…)
 * @param {number} [args.frames]      frame count (defaults per motion)
 * @param {number} [args.fps]
 * @param {boolean}[args.loop]
 * @param {function}[args.resolveProgramRef]  threaded to the renderer for program subjects
 * @returns {{ frameSvgs: string[], flipbookSvg: string, viewBox: number[], meta: object }}
 */
export function renderMotion({ manifest, motion, params = {}, frames, fps = 12, loop = true, resolveProgramRef }) {
  if (!manifest || manifest.kind !== 'manji-tree') {
    throw new Error(
      "forge_motion Phase 1 subjects must be manji-tree manifests (a stored manji-tree sketch, the figure rig, or a terrain world). painted-landscape subjects land in Phase 2.",
    );
  }
  if (!MOTION_NAMES.includes(motion)) {
    throw new Error(`unknown motion '${motion}'. Phase 1 camera motions: ${MOTION_NAMES.join(', ')}`);
  }
  const frameCount = frames || DEFAULT_FRAMES[motion] || 24;

  const { cameras, viewBoxStrategy, fixedViewBox } = cameraPathFor(motion, {
    manifest,
    frames: frameCount,
    params,
  });
  const rendered = renderSubjectFrames({ manifest, cameras, resolveProgramRef });
  const viewBox = chooseViewBox({ strategy: viewBoxStrategy, fixedViewBox, frames: rendered });
  const bodies = rendered.map((f) => f.body);

  const width = params.width;
  const flipbookSvg = composeFlipbook({ frames: bodies, viewBox, fps, width, loop });
  const frameSvgs = bodies.map((body) => stillFrameSvg({ body, viewBox, width }));

  return {
    frameSvgs,
    flipbookSvg,
    viewBox,
    meta: { motion, frames: frameCount, fps, loop, viewBoxStrategy },
  };
}
