/**
 * Scene raster core (scene-promotion.plan.md SP0) — the pure frame producer the
 * `forge_motion { scene }` family needs. Given a scene recipe + INJECTED asset
 * providers, composites the multiplane layers and returns `framePngs[]` (the
 * exact shape forgeMotionHandler's raster branch already turns into a GIF/MP4).
 * No filesystem, no demo config, no CLI — asset sourcing is the caller's job
 * (disk in the spike; boundRenderMap / `mo_` frames in promotion).
 *
 * Deterministic (sharp only; no Date/Math.random). Frame planning lives in
 * scene-compose.js (`resolveSceneFrames`); this is raster only.
 */
import sharp from 'sharp';
import { resolveSceneFrames } from './scene-compose.js';

/**
 * @param scene     a validated scene recipe ({ fps, frame, stage, cast, shots })
 * @param providers.plate  PNG buffer for the plate band (sized to stage.plate dims),
 *                         OR async (ref) => PNG buffer when shots carry their own
 *                         stages (the cross-cut: 'plate', 'plate-shot-<i>', …)
 * @param providers.band   async (ref) => PNG buffer for an occluder band, or null
 * @param providers.cel    async (clipRef, keyDir, celFile) => keyed cel PNG buffer
 * @param providers.downscale  optional { width, height } for the output frames
 * @returns framePngs: Buffer[]  (one PNG per output frame)
 */
export async function renderSceneFrames(scene, { plate, band, cel, downscale } = {}) {
  const frame = scene.frame;
  const { frames } = resolveSceneFrames(scene);
  const out = [];
  for (const fr of frames) {
    const composites = [];
    for (const layer of fr.layers) {                         // far → near (already sorted)
      if (layer.kind === 'band') {
        const src = layer.plate
          ? (typeof plate === 'function' ? await plate(layer.ref) : plate)
          : (band ? await band(layer.ref) : null);
        if (!src) continue;
        const m = await sharp(src).metadata();                // band native size × lens scale
        const c = await frameClip(src, m.width * layer.scale, m.height * layer.scale, layer.left, layer.top, frame);
        if (c) composites.push(c);
      } else {
        if (layer.shadow) {                                   // contact AO pool, under the feet
          const s = await shadowClip(layer.shadow, frame);
          if (s) composites.push(s);
        }
        const buf = await cel(layer.clipRef, layer.keyDir, layer.celFile);
        const c = await frameClip(buf, layer.box.width, layer.box.height, layer.box.left, layer.box.top, frame);
        if (c) composites.push(c);
      }
    }
    // composite at full size, THEN downscale in a separate pass — a resize chained
    // after composite makes sharp shrink the BASE first and reject full-size inputs.
    const full = await sharp({ create: { width: frame.width, height: frame.height, channels: 4, background: '#000' } })
      .composite(composites).png().toBuffer();
    out.push(downscale ? await sharp(full).resize(downscale).png().toBuffer() : full);
  }
  return out;
}

// contact-shadow ellipse (soft AO pool) → a frame-positioned composite descriptor
async function shadowClip({ cx, cy, rx, ry, opacity }, frame) {
  const pad = ry * 2.2;                                       // room for the blur skirt
  const w = Math.ceil(rx * 2 + pad * 2);
  const h = Math.ceil(ry * 2 + pad * 2);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>`
    + `<defs><filter id='b'><feGaussianBlur stdDeviation='${(ry * 0.55).toFixed(1)}'/></filter></defs>`
    + `<ellipse cx='${w / 2}' cy='${h / 2}' rx='${rx}' ry='${ry}' fill='black' opacity='${opacity}' filter='url(#b)'/></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return frameClip(png, w, h, cx - w / 2, cy - h / 2, frame);
}

// clip a resized layer to the frame and return a sharp composite descriptor
async function frameClip(pngBuf, drawW, drawH, left, top, frame) {
  const w0 = Math.max(1, Math.round(drawW));
  const h0 = Math.max(1, Math.round(drawH));
  const L = Math.round(left); const T = Math.round(top);
  const sx = Math.max(0, -L); const sy = Math.max(0, -T);
  const dx = Math.max(0, L); const dy = Math.max(0, T);
  const w = Math.min(w0 - sx, frame.width - dx);
  const h = Math.min(h0 - sy, frame.height - dy);
  if (w <= 0 || h <= 0) return null;
  let img = sharp(pngBuf).resize({ width: w0, height: h0, fit: 'fill' });
  if (sx || sy || w !== w0 || h !== h0) img = img.extract({ left: sx, top: sy, width: w, height: h });
  return { input: await img.png().toBuffer(), left: dx, top: dy };
}
