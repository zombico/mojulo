/**
 * The composite pass — deterministic motion over externally-painted stills
 * (pan-cel-motion.plan.md, spike build step 5). frame t = eased window crop
 * of the plate + the scheduled cel at its anchor, matte-lifted through a
 * feathered silhouette mask. Given (manifest, stills) the frame buffers are
 * byte-stable; the GIF encode rides encodeGifBuffers.
 */

import sharp from 'sharp';

import { resolveWindowPath, resolveSchedule } from './window.js';
import { celSilhouetteSvg, cyclePoseFigure } from './cycle-poses.js';
import { resolveSubCelTracks, subCelStates } from './sub-cels.js';

export async function rasterSvg(svg, { width, height }) {
  return sharp(Buffer.from(svg)).resize({ width, height, fit: 'fill' }).png().toBuffer();
}

/**
 * The feathered matte for a cel: its pose silhouette drawn fat and white,
 * rasterized, blurred. Used as the alpha channel that lifts an OPAQUE
 * generated cel (an in-place render over a plate crop) off its rectangle.
 */
export async function celMattePng(manifest, celId) {
  const cel = manifest.cels.find((c) => c.id === celId);
  if (!cel) throw new Error(`unknown cel '${celId}'`);
  const rect = manifest.schedule.celRect;
  const fig = manifest.schedule.figure;
  const svg = celSilhouetteSvg({ rect, figure: { ...fig, pose: cel.pose } });
  return sharp(Buffer.from(svg))
    .resize({ width: rect.w, height: rect.h, fit: 'fill' })
    .flatten({ background: '#000000' })
    .blur(9)
    .toColourspace('b-w')
    .png()
    .toBuffer();
}

/**
 * Difference matte — the matte derived from the RENDER, not the stick.
 * A cel generated in-place repaints its plate crop "as-is"; whatever
 * differs from the raw plate crop IS the character (and her contact
 * shadow). Soft-thresholded so paint drift stays transparent while the
 * figure goes opaque; the shadow rides at partial alpha. Uses only files
 * we already have — no new generations, no silhouette guessing.
 */
export async function differenceMatte(celPng, platePng, crop, { w, h, floor = 14, gain = 5 } = {}) {
  const cel = await sharp(celPng).resize({ width: w, height: h, fit: 'fill' }).removeAlpha().raw().toBuffer();
  const plate = await sharp(platePng)
    .extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h })
    .resize({ width: w, height: h, fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const mask = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i += 1) {
    const d = Math.max(
      Math.abs(cel[i * 3] - plate[i * 3]),
      Math.abs(cel[i * 3 + 1] - plate[i * 3 + 1]),
      Math.abs(cel[i * 3 + 2] - plate[i * 3 + 2]),
    );
    mask[i] = Math.max(0, Math.min(255, (d - floor) * gain));
  }
  // close small holes + feather: blur → re-gain the core toward opaque
  const soft = await sharp(mask, { raw: { width: w, height: h, channels: 1 } })
    .blur(3)
    .raw()
    .toBuffer();
  for (let i = 0; i < w * h; i += 1) soft[i] = Math.max(0, Math.min(255, (soft[i] - 24) * 2.2));
  return sharp(soft, { raw: { width: w, height: h, channels: 1 } }).blur(1.5).png().toBuffer();
}

/**
 * Chroma-key matte for the acetate contract's no-alpha fallback: distance
 * from flat chroma green → alpha. Deterministic, no guessing.
 */
export async function chromaKeyMatte(celPng, { w, h, keyColor = [0, 255, 0], floor = 60, gain = 3 } = {}) {
  const rgb = await sharp(celPng).resize({ width: w, height: h, fit: 'fill' }).removeAlpha().raw().toBuffer();
  const mask = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i += 1) {
    const d = Math.max(
      Math.abs(rgb[i * 3] - keyColor[0]),
      Math.abs(rgb[i * 3 + 1] - keyColor[1]),
      Math.abs(rgb[i * 3 + 2] - keyColor[2]),
    );
    mask[i] = Math.max(0, Math.min(255, (d - floor) * gain));
  }
  return sharp(mask, { raw: { width: w, height: h, channels: 1 } }).blur(1.2).png().toBuffer();
}

/**
 * The mojulo-owned contact shadow (acetate cels carry NO painted shadow —
 * the compositor draws it, so it is identical across every cel and every
 * frame). A soft ellipse under the feet, offset along the stated light
 * direction (sun frame-left → shadow falls frame-right).
 */
export function contactShadowSvg(manifest) {
  const rect = manifest.schedule.celRect;
  const fig = manifest.schedule.figure;
  const cx = fig.x - rect.x + 26; // offset toward frame-right
  const cy = fig.y + 104 * fig.scale - rect.y + 4;
  const rx = 46 * fig.scale;
  const ry = 8 * fig.scale;
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rect.w} ${rect.h}" width="${rect.w}" height="${rect.h}">
  <defs><filter id="soft" x="-40%" y="-120%" width="180%" height="340%"><feGaussianBlur stdDeviation="9"/></filter></defs>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1a1410" opacity="0.38" filter="url(#soft)"/>
</svg>`;
}

/**
 * Cel registration — pin the figure's feet to the manifest ground line.
 * Each generation places the character slightly differently in its canvas
 * (observed: ±17px of feet-bottom jitter across a 6-cel cycle), which
 * composites as bounce/slide against the ground. Mojulo KNOWS the ground
 * line (figure anchor + 104·scale, the poseFigure geometry), so it
 * re-imposes it: measure the alpha bbox bottom, translate vertically.
 * Horizontal placement is left alone — stride asymmetry is legitimate.
 */
export async function registerAcetateFigure(figurePng, { w, h, groundY, alphaFloor = 40 }) {
  const { data } = await sharp(figurePng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let maxY = -1;
  for (let y = h - 1; y >= 0 && maxY === -1; y -= 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > alphaFloor) { maxY = y; break; }
    }
  }
  if (maxY === -1) throw new Error('registerAcetateFigure: cel has no opaque pixels');
  const dy = Math.round(groundY - maxY);
  if (dy === 0) return { png: figurePng, dy };
  const blank = sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const src = dy > 0
    ? figurePng
    : await sharp(figurePng).extract({ left: 0, top: -dy, width: w, height: h + dy }).png().toBuffer();
  const png = await blank.composite([{ input: src, left: 0, top: Math.max(0, dy) }]).png().toBuffer();
  return { png, dy };
}

/**
 * Prepare an acetate cel for compositing: alpha PNG used as-is, chroma green
 * keyed out otherwise; feet registered to the ground line; then the
 * deterministic contact shadow goes UNDER the figure, so one RGBA patch
 * composites per frame.
 */
export async function prepareAcetateCel(manifest, celPng) {
  const rect = manifest.schedule.celRect;
  const fig = manifest.schedule.figure;
  const { w, h } = { w: rect.w, h: rect.h };
  const meta = await sharp(celPng).metadata();
  let figure;
  if (meta.hasAlpha) {
    figure = await sharp(celPng).resize({ width: w, height: h, fit: 'fill' }).png().toBuffer();
  } else {
    const matte = await chromaKeyMatte(celPng, { w, h });
    figure = await applyMatte(celPng, matte, { w, h });
  }
  const groundY = Math.round(fig.y + 104 * fig.scale - rect.y);
  const { png: registered, dy } = await registerAcetateFigure(figure, { w, h, groundY });
  const shadow = await rasterSvg(contactShadowSvg(manifest), { width: w, height: h });
  const png = await sharp(shadow).composite([{ input: registered }]).png().toBuffer();
  return Object.assign(png, { registrationDy: dy });
}

/** An opaque cel PNG + its matte → a cel with a feathered alpha edge. */
export async function applyMatte(celPng, mattePng, { w, h }) {
  const rgb = await sharp(celPng).resize({ width: w, height: h, fit: 'fill' }).removeAlpha().toBuffer();
  const alpha = await sharp(mattePng).resize({ width: w, height: h, fit: 'fill' }).toColourspace('b-w').toBuffer();
  return sharp(rgb).joinChannel(alpha).png().toBuffer();
}

/** The placeholder cel for the pipeline proof: the stick figure alone on transparent. */
export async function placeholderCelPng(manifest, celId) {
  const cel = manifest.cels.find((c) => c.id === celId);
  const rect = manifest.schedule.celRect;
  const fig = manifest.schedule.figure;
  const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rect.w} ${rect.h}" width="${rect.w}" height="${rect.h}">${cyclePoseFigure({ x: fig.x - rect.x, y: fig.y - rect.y, scale: fig.scale, pose: cel.pose, facing: cel.facing })}</svg>`;
  return rasterSvg(svg, { width: rect.w, height: rect.h });
}

/**
 * Composite a HELD sub-cel shot (the talking-mouth + blink primitive).
 * `stills` maps '<subCelId>/<state>' → an opaque PNG sized to that sub-cel's
 * rect; BASE states (each vocab's first state) are painted into the held cel
 * and need no still. Returns { frames: Buffer[], tracks }.
 */
export async function compositeHeldFrames({ manifest, heldPng, stills }) {
  const n = Math.round(manifest.fps * manifest.durationSec);
  const tracks = resolveSubCelTracks(manifest, n);
  const base = Object.fromEntries(manifest.subCels.map((sc) => [sc.id, subCelStates(sc.vocab)[0]]));

  const frames = [];
  for (let f = 0; f < n; f += 1) {
    const overlays = [];
    for (const sc of manifest.subCels) {
      const state = tracks[sc.id][f];
      if (state === base[sc.id]) continue; // base state lives in the held cel
      const still = stills.get(`${sc.id}/${state}`);
      if (!still) throw new Error(`no still for sub-cel state '${sc.id}/${state}'`);
      overlays.push({ input: still, left: sc.rect.x, top: sc.rect.y });
    }
    const img = sharp(heldPng);
    frames.push(await (overlays.length ? img.composite(overlays) : img).png().toBuffer());
  }
  return { frames, tracks };
}

/**
 * Composite every frame. `cels` maps cel id → an RGBA PNG (already matted or
 * inherently transparent). Returns { frames: Buffer[], windowRects, schedule }.
 */
export async function compositeFrames({ manifest, platePng, cels }) {
  const windowRects = resolveWindowPath(manifest);
  const schedule = resolveSchedule(manifest, windowRects);
  const { width: fw, height: fh } = manifest.frame;

  const frames = [];
  for (const { frame, celId, rect } of schedule) {
    const win = windowRects[frame];
    const celPng = cels.get(celId);
    if (!celPng) throw new Error(`no still for cel '${celId}'`);
    let img = sharp(platePng).extract({ left: win.x, top: win.y, width: win.w, height: win.h });
    if (win.w !== fw || win.h !== fh) img = img.resize({ width: fw, height: fh, fit: 'fill' }); // crop-zoom
    const buf = await img
      .composite([{ input: celPng, left: rect.x, top: rect.y }])
      .png()
      .toBuffer();
    frames.push(buf);
  }
  return { frames, windowRects, schedule };
}
