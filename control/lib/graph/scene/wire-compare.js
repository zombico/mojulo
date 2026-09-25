/**
 * wire-compare — the MATCHED-AZIMUTH compare: a source's silhouette from a named view against a reference
 * silhouette at the same azimuth, as numbers. The block-architecture spike's finding made a gate: a render
 * and its reference only compare honestly when they share a camera, so the reference is read at a NAMED
 * azimuth (depth-raster.js) and the source is drawn at that azimuth by construction.
 *
 * Shape, not placement: a dreamed reference has its own framing, so both silhouettes are normalised to
 * their bounding boxes (the reference scaled to the source's box height, aspect kept, centred) before the
 * overlap is taken. Reported per view: `iou` (overlap over union of the normalised masks), `aspect` (the
 * reference's width/height over the source's), `centroid` (the reference's centroid offset from the
 * source's, as a fraction of the height, x right and y down), `fill` (how much of its box the reference fills;
 * a line drawing scores a note, since the compare wants a filled silhouette), and per-group masks when the
 * source's face groups are asked for (`groups`). The reference is never persisted; only the numbers are.
 *
 * Masks: `maskFromRaster` (a source through a camera), `maskFromPixels` (a decoded PNG: a pixel is
 * foreground when it differs from the background sampled at the corners by more than `threshold`, or
 * when its alpha is below full and `alpha` is set). PNG decoding and the side-by-side sheet use `sharp`,
 * imported lazily; the pure parts need nothing.
 */
import { rasterDepth, rasterMask, viewCamera, viewAzimuth } from './depth-raster.js';

const r3 = (x) => Math.round(x * 1000) / 1000;

/** bbox of a mask: [x0, y0, x1, y1] inclusive, or null. */
export function maskBBox(mask, res) {
  let x0 = res, y0 = res, x1 = -1, y1 = -1;
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) if (mask[j * res + i]) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  return x1 < 0 ? null : [x0, y0, x1, y1];
}
const centroidOf = (mask, res) => { let sx = 0, sy = 0, n = 0; for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) if (mask[j * res + i]) { sx += i + 0.5; sy += j + 0.5; n++; } return n ? [sx / n, sy / n] : null; };

/** Resample a mask (res `from`) into a `to` × `to` mask so that its bbox maps onto `box`: each target pixel takes the
 * majority of a 4 × 4 supersample of its source footprint, so a downsampled edge stays where it was. */
export function fitMask(mask, from, box, to) {
  const src = maskBBox(mask, from); const out = new Uint8Array(to * to); if (!src) return out;
  const sw = src[2] - src[0] + 1, sh = src[3] - src[1] + 1; const bw = box[2] - box[0] + 1, bh = box[3] - box[1] + 1; const S = 4;
  for (let j = box[1]; j <= box[3]; j++) for (let i = box[0]; i <= box[2]; i++) {
    if (i < 0 || j < 0 || i >= to || j >= to) continue; let hits = 0;
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
      const u = src[0] + Math.floor((i - box[0] + (a + 0.5) / S) / bw * sw), v = src[1] + Math.floor((j - box[1] + (b + 0.5) / S) / bh * sh);
      if (u >= 0 && v >= 0 && u < from && v < from && mask[v * from + u]) hits++;
    }
    if (hits * 2 >= S * S) out[j * to + i] = 1;
  }
  return out;
}

/** IoU of two masks of the same size. */
export function maskIoU(a, b) { let inter = 0, uni = 0; for (let k = 0; k < a.length; k++) { const x = a[k] | b[k]; if (x) { uni++; if (a[k] & b[k]) inter++; } } return uni ? inter / uni : 1; }

/** A reference's mask from raw RGBA pixels: background = the mean of the four corner pixels. */
export function maskFromPixels({ data, width, height, channels = 4 }, { threshold = 40, alpha = true } = {}) {
  const at = (x, y) => { const k = (y * width + x) * channels; return [data[k], data[k + 1], data[k + 2], channels > 3 ? data[k + 3] : 255]; };
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)]; const bg = [0, 1, 2].map((c) => corners.reduce((s, p) => s + p[c], 0) / 4);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const p = at(x, y); const d = Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]); if (d > threshold || (alpha && p[3] < 250 && p[3] > 0 && d > threshold / 2)) mask[y * width + x] = 1; }
  return { mask, width, height };
}
/** A pixel mask padded into a square mask at its own resolution (max(width, height), capped at `cap`; top-left
 * aligned — the fit normalises placement anyway). Returns { mask, res }. */
export function squareMask({ mask, width, height }, cap = 1024) {
  const side = Math.max(width, height); const res = Math.min(side, cap); const s = side / res; const out = new Uint8Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const x = Math.floor(i * s), y = Math.floor(j * s); if (x < width && y < height && mask[y * width + x]) out[j * res + i] = 1; }
  return { mask: out, res };
}

/** The source's silhouette from a named view (and per-group masks when `groups` names face groups). */
export function sourceSilhouette(source, view, { res = 256, elevationDegrees = 10, groups = null } = {}) {
  const cam = viewCamera(source, view, { elevationDegrees }); const raster = rasterDepth(source, cam, res); const mask = rasterMask(raster);
  const byGroup = {}; if (groups && source.groups) for (const g of groups) byGroup[g] = rasterMask(raster, (fi) => source.groups[fi] === g);
  return { view: String(view), azimuth: viewAzimuth(view), res, mask, groups: byGroup, raster };
}

/** Compare a source silhouette against a reference mask (any size, square): numbers only. */
export function compareSilhouette(sil, refSquare, refRes) {
  const res = sil.res; const box = maskBBox(sil.mask, res); if (!box) return { iou: 0, aspect: null, centroid: null, note: 'the source covers no pixel' };
  const refBox = maskBBox(refSquare, refRes); if (!refBox) return { iou: 0, aspect: null, centroid: null, note: 'the reference has no foreground' };
  const bh = box[3] - box[1] + 1; const refAspect = (refBox[2] - refBox[0] + 1) / (refBox[3] - refBox[1] + 1); const srcAspect = (box[2] - box[0] + 1) / bh;
  // the reference scaled to the source's height, aspect kept, centred on the source's box
  const w = Math.round(bh * refAspect); const cx = (box[0] + box[2]) / 2; const target = [Math.round(cx - w / 2), box[1], Math.round(cx - w / 2) + w - 1, box[3]];
  const fitted = fitMask(refSquare, refRes, target, res);
  const c0 = centroidOf(sil.mask, res), c1 = centroidOf(fitted, res);
  // how much of its own box the reference fills: a silhouette fills most of it, a line drawing almost none
  let refCount = 0; for (let k = 0; k < refSquare.length; k++) refCount += refSquare[k];
  const fill = r3(refCount / ((refBox[2] - refBox[0] + 1) * (refBox[3] - refBox[1] + 1)));
  const out = { iou: r3(maskIoU(sil.mask, fitted)), aspect: r3(refAspect / srcAspect), centroid: c0 && c1 ? [r3((c1[0] - c0[0]) / bh), r3((c1[1] - c0[1]) / bh)] : null, fill, fitted };
  if (fill < 0.2) out.note = 'the reference is sparse (line art?): the compare wants a filled silhouette — a clay render or a mask, not a wire drawing';
  return out;
}

/** Read a PNG (or any image sharp reads) into a square reference mask { mask, res } at the picture's own resolution. Lazy sharp. */
export async function referenceMask(path, { threshold = 40, cap = 1024 } = {}) {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return squareMask(maskFromPixels({ data, width: info.width, height: info.height, channels: info.channels }, { threshold }), cap);
}

/** Write a side-by-side sheet (reference | source silhouette | overlap) as a PNG. Lazy sharp. */
export async function writeCompareSheet(path, sil, refSquare, refRes, fitted) {
  const { default: sharp } = await import('sharp'); const res = sil.res; const W = res * 3;
  const px = Buffer.alloc(W * res * 3, 255);
  const put = (panel, i, j, rgb) => { const k = ((j * W) + panel * res + i) * 3; px[k] = rgb[0]; px[k + 1] = rgb[1]; px[k + 2] = rgb[2]; };
  const refFit = fitMask(refSquare, refRes, [0, 0, res - 1, res - 1], res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const k = j * res + i; if (refFit[k]) put(0, i, j, [60, 60, 60]); if (sil.mask[k]) put(1, i, j, [40, 80, 160]);
    const a = sil.mask[k], b = fitted ? fitted[k] : 0; if (a && b) put(2, i, j, [50, 140, 60]); else if (a) put(2, i, j, [40, 80, 160]); else if (b) put(2, i, j, [200, 70, 50]);
  }
  await sharp(px, { raw: { width: W, height: res, channels: 3 } }).png().toFile(path);
  return path;
}
