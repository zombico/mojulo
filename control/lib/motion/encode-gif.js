/**
 * Motion — frame SVGs → animated GIF, zero new dependencies.
 *
 * The Regime-B path emits N discrete STATIC frame SVGs, so GIF export needs no
 * headless browser to tick CSS. The whole pipeline rides on control's bundled
 * `sharp` (libvips ≥ 8.17 has cgif compiled in for animated-GIF output +
 * imagequant for quantization). Consolidated from
 * lite-template/integration/0609/spike-output/motion-gif/svg-to-gif.mjs — the
 * `createRequire` hack is gone now that this lives inside control.
 *
 * Pipeline:  each frame SVG ─sharp raster→ PNG buffer (uniform W×H)
 *            ─sharp(frames,{join:{animated:true}}).gif({delay,loop})→ animated GIF.
 */

import { promises as fs } from 'node:fs';

import sharp from 'sharp';

/**
 * Encode an array of self-contained SVG strings into an animated GIF on disk.
 *
 * @param {string[]} frameSvgs  full SVG strings, one per frame (shared viewBox)
 * @param {string}   outPath    destination .gif path
 * @param {object}   opts       { width, fps, bg, loop, density }
 * @returns {Promise<{ outPath, frames, width, height, fps, bytes }>}
 */
export async function encodeGif(frameSvgs, outPath, opts = {}) {
  const { width = 640, fps = 12, bg = '#ffffff', loop = 0, density = 160 } = opts;
  if (!frameSvgs.length) throw new Error('encodeGif: no frames');

  // Lock a common W×H from the first frame's aspect (frames share a viewBox, so
  // this is uniform). Even dimensions keep the encoder happy.
  const first = Buffer.from(frameSvgs[0]);
  const meta = await sharp(first, { density }).metadata();
  const W = width;
  let H = Math.round(width * (meta.height / meta.width));
  if (H % 2) H += 1;

  const rasterOne = (svg) =>
    sharp(Buffer.from(svg), { density })
      .resize({ width: W, height: H, fit: 'fill' })
      .flatten({ background: bg }) // GIF wants opaque; composite onto the frame bg
      .png()
      .toBuffer();

  const pngs = [];
  for (const svg of frameSvgs) pngs.push(await rasterOne(svg));

  const delayMs = Math.round(1000 / fps);
  await sharp(pngs, { join: { animated: true } })
    .gif({ delay: new Array(pngs.length).fill(delayMs), loop })
    .toFile(outPath);

  const { size } = await fs.stat(outPath);
  return { outPath, frames: frameSvgs.length, width: W, height: H, fps, bytes: size };
}

/**
 * Encode an array of uniform PNG buffers (e.g. headless three.js World frames) into
 * an animated GIF. The world frame source arrives already rasterized at a fixed W×H,
 * so this skips the SVG raster step encodeGif does — it just normalizes every frame
 * to the first frame's size (cheap no-op when they already match) and joins them.
 *
 * @param {Buffer[]} pngBuffers  one PNG per frame
 * @param {string}   outPath     destination .gif path
 * @param {object}   opts        { fps, loop }
 * @returns {Promise<{ outPath, frames, width, height, fps, bytes }>}
 */
export async function encodeGifBuffers(pngBuffers, outPath, opts = {}) {
  const { fps = 12, loop = 0 } = opts;
  if (!pngBuffers.length) throw new Error('encodeGifBuffers: no frames');

  const meta = await sharp(pngBuffers[0]).metadata();
  const W = meta.width;
  let H = meta.height;
  if (H % 2) H += 1;

  const frames = [];
  for (const buf of pngBuffers) {
    // normalize to a common W×H so the animated join never rejects a stray off-by-one.
    frames.push(await sharp(buf).resize({ width: W, height: H, fit: 'fill' }).png().toBuffer());
  }

  const delayMs = Math.round(1000 / fps);
  await sharp(frames, { join: { animated: true } })
    .gif({ delay: new Array(frames.length).fill(delayMs), loop })
    .toFile(outPath);

  const { size } = await fs.stat(outPath);
  return { outPath, frames: frames.length, width: W, height: H, fps, bytes: size };
}
