/**
 * Turntable strip bake — N azimuth frames of one world, composited into a single
 * PNG the gallery card steps through with CSS.
 *
 * Almost none of this is new machinery. The frames come from `renderWorldMotion`
 * with motion `turntable` — the same 360° `orbitPath` camera `forge_motion`
 * animates with, driven through the same capture bridge (one Chromium, ONE WebGL
 * context and geometry upload for all 16 frames, so the cost is per-frame
 * screenshot rather than per-frame init). The only thing added here is laying the
 * frames out in a row and remembering the result.
 *
 * Two properties matter for a gallery, and they are what the rest of this file is:
 *
 *   • Cached on disk, keyed by manifest. Same shape as the scene-PNG cache in
 *     sketch-png.js: `data/turntable/<ref>-<hash>.png`, with a bumpable version
 *     in the key so a camera/lighting change invalidates every strip at once.
 *   • Bounded. A mouse swept across a grid of 24 cold cards must not launch 24
 *     browsers. Requests for the same strip share one bake, and bakes run one at
 *     a time behind a queue.
 *
 * Design: components/3d-factory-ui.plan.md §6.
 */

import { promises as fs, existsSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

import { isTurnable, TURNTABLE_FRAMES, TURNTABLE_CELL, TURNTABLE_FPS } from './turntable-strip';

// Bump when the bake's output changes in a way that should invalidate strips
// already on disk (frame count, cell size, camera path, world lighting model).
const STRIP_CACHE_VERSION = 'v1';

function stripCacheDir() {
  return process.env.MOJULO_TURNTABLE_DIR || path.join(process.cwd(), 'data', 'turntable');
}

/** Cache identity: the recipe plus everything about how we filmed it. */
export function stripCacheKey(sketch, { frames = TURNTABLE_FRAMES, cell = TURNTABLE_CELL } = {}) {
  const payload = JSON.stringify({ v: STRIP_CACHE_VERSION, frames, cell, manifest: sketch?.manifest });
  return crypto.createHash('sha1').update(payload).digest('hex').slice(0, 16);
}

/** Where this sketch's strip lives on disk (whether or not it has been baked yet). */
export function stripCacheFile(sketch, opts = {}) {
  return path.join(stripCacheDir(), `${sketch?.ref || 'strip'}-${stripCacheKey(sketch, opts)}.png`);
}

// ── bake gate ────────────────────────────────────────────────────────────────
// One bake at a time, and one bake per strip no matter how many callers ask.
// CHAIN serializes (a browser + WebGL context is the expensive resource, and a
// hover storm is exactly the case that would otherwise start a dozen); INFLIGHT
// dedupes, so the card, a second card of the same world, and the mint-time warm
// all await the same promise.
let CHAIN = Promise.resolve();
const INFLIGHT = new Map();

function enqueue(key, task) {
  const existing = INFLIGHT.get(key);
  if (existing) return existing;
  const run = () => task();
  const p = CHAIN.then(run, run).finally(() => INFLIGHT.delete(key));
  CHAIN = p.then(() => {}, () => {});   // the queue survives a failed bake
  INFLIGHT.set(key, p);
  return p;
}

/**
 * Bake (or read from cache) one artifact's turntable strip.
 *
 * @param {{ ref?: string, title?: string, manifest: object }} sketch
 * @param {object} [opts]
 * @param {number} [opts.frames]
 * @param {{width:number,height:number}} [opts.cell]
 * @returns {Promise<Buffer>} PNG bytes — one row of `frames` cells
 */
export async function bakeTurntableStrip(sketch, { frames = TURNTABLE_FRAMES, cell = TURNTABLE_CELL } = {}) {
  if (!sketch?.manifest) throw new Error('bakeTurntableStrip requires a sketch manifest');
  if (!isTurnable(sketch.manifest)) {
    const err = new Error(
      `'${sketch.manifest.kind}' has no orbit to film — turntable strips are baked for the 3D kinds `
      + '(worlds, objects, scenes). Flat artifacts show their still instead.',
    );
    err.code = 'NOT_TURNABLE';
    throw err;
  }

  const file = stripCacheFile(sketch, { frames, cell });
  if (existsSync(file)) return fs.readFile(file);

  return enqueue(file, async () => {
    // A second caller may have finished the bake while this one sat in the queue.
    if (existsSync(file)) return fs.readFile(file);

    // Deferred: the heavy renderer (puppeteer + the world assemblers) stays off
    // the import graph of anything that merely wants a cache path.
    const { renderWorldMotion } = await import('@/lib/motion/world-motion');
    const { framePngs } = await renderWorldMotion({
      sketch,
      motion: 'turntable',
      frames,
      fps: TURNTABLE_FPS,
      params: { width: cell.width, height: cell.height },
    });
    if (!framePngs?.length) throw new Error(`turntable bake produced no frames for '${sketch.ref}'`);

    const png = await compositeStrip(framePngs, { frames, cell });
    // Best-effort cache write; a failed write just means the next view re-bakes.
    try {
      await fs.mkdir(stripCacheDir(), { recursive: true });
      await fs.writeFile(file, png);
    } catch {
      /* ignore cache write failures */
    }
    return png;
  });
}

/**
 * Lay the frames out left to right in one row. Each frame is resized to the cell
 * first: the capture already sizes its viewport to the cell, but the strip's
 * geometry IS the animation contract (the CSS steps through whole cells), so a
 * one-pixel drift from a device-scale rounding cannot be allowed to shear it.
 */
async function compositeStrip(framePngs, { frames, cell }) {
  const sharp = (await import('sharp')).default;
  const cells = await Promise.all(
    framePngs.slice(0, frames).map((buf) => sharp(buf)
      .resize(cell.width, cell.height, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer()),
  );
  return sharp({
    create: {
      width: cell.width * cells.length,
      height: cell.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(cells.map((input, i) => ({ input, left: i * cell.width, top: 0 })))
    .png()
    .toBuffer();
}
