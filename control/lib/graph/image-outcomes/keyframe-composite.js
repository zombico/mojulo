/**
 * Keyframe clip compositor (mcp-promotion.plan.md A3) — turns a finished
 * keyframe-animation clip's ACCEPTED cels into output frame PNGs, the raster
 * shape forgeMotionHandler already encodes to GIF/MP4. Zero generations: this
 * only SELECTS and resizes cels the render handoff already audited and stored.
 *
 * Frame selection is face-composite.js's job (seeded blink dice / speech flap
 * spans / forcedFrames, keys × onTwos × cycles) — this module adapts a
 * normalized keyframe-animation manifest onto that scheduler and loads the
 * chosen cel per frame through a caller-supplied provider (the store-backed
 * one lives in scene-forge.js's resolveClipForge). Pure: no fs, no repos, no
 * Date/Math.random.
 */
import sharp from 'sharp';

import { buildFaceManifest, resolveFaceFrames } from './keyframe-spike/face-composite.js';

/**
 * Resolve a normalized keyframe-animation manifest into per-output-frame cel
 * selections: [{ frame, key:'key-N', celFile:'cel.png'|'face/<vocab>-<state>.png', … }].
 * A manifest with no face channels selects the body cel on every frame; the
 * count is always keys × onTwos × cycles.
 */
export function clipFrameSelections(km) {
  const keys = Array.from({ length: km.keys }, (_, i) => `key-${i}`);
  const manifest = buildFaceManifest({
    keys,
    fps: km.fps,
    onTwos: km.onTwos,
    cycles: km.cycles,
    blink: km.blink ?? null,
    speech: km.speech?.spans?.length ? km.speech : null,
    flapsPerSec: km.speech?.flapsPerSec ?? 8,
  });
  return resolveFaceFrames(manifest).frames;
}

/**
 * Composite the selections into frame PNG buffers. `cel(keyDir, celFile)` is
 * the async provider for one stored cel (full-canvas painted PNG — the clip
 * plays on its own painted background, no keying). Distinct cels are loaded
 * once and reused across frames, so re-timing stays cheap.
 *
 * @param {object} args
 * @param {Array}  args.selections  clipFrameSelections output
 * @param {Function} args.cel       async (keyDir, celFile) => Buffer (PNG)
 * @param {{width:number,height:number}} [args.downscale]  output frame size
 * @returns {Promise<Buffer[]>} one PNG buffer per output frame
 */
export async function compositeCels({ selections, cel, downscale }) {
  const cache = new Map();
  const framePngs = [];
  for (const sel of selections) {
    const cacheKey = `${sel.key}/${sel.celFile}`;
    if (!cache.has(cacheKey)) {
      let buf = await cel(sel.key, sel.celFile);
      if (!buf) throw new Error(`clip cel '${cacheKey}' has no stored render`);
      if (downscale) {
        buf = await sharp(buf)
          .resize({ width: downscale.width, height: downscale.height, fit: 'fill' })
          .png()
          .toBuffer();
      }
      cache.set(cacheKey, buf);
    }
    framePngs.push(cache.get(cacheKey));
  }
  return framePngs;
}
