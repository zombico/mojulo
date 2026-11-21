/**
 * front-treatments — a start screen's pictures made graphic (game/front-stage.js `treatment`). A subject is captured
 * twice, over black and over white (game/front-plates.js), and cut out by the difference: what stays the same is the
 * subject, what moves with the background is not, and the edge between (anti-aliasing, a glow) is part of both. The
 * cut-out is then trimmed to the subject and drawn in one of the treatments, each in the game's own colours.
 *
 * Pure: an image is { width, height, data } (RGBA, 8 bits a channel, rows top down); nothing here reads a file, a
 * clock or dice, so the same capture and colours make the same picture.
 *
 *   matte(overBlack, overWhite)        → image: the subject alone, its alpha from the difference
 *   trimRect(image, { pad, threshold }) → { x, y, w, h } | null: where that crop falls in the frame
 *   trimmed(image, { pad, threshold }) → image: cropped to where the alpha is, `pad` pixels kept round it
 *   treat(image, treatment, colours)   → image: one of STAGE_TREATMENTS; colours { ink, accent, bg } as #rrggbb
 *   TREATMENT_FNS                      treatment → (image, colours) → image
 */
import { STAGE_TREATMENTS } from './front-stage.js';

const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const hexRgb = (h) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || ''));
  if (!m) return [255, 255, 255];
  const s = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const blank = (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });
const sameSize = (a, b) => a.width === b.width && a.height === b.height && a.data.length === b.data.length;

/** The subject over black and over white → the subject alone (straight alpha). */
export function matte(overBlack, overWhite) {
  if (!sameSize(overBlack, overWhite)) throw new Error('matte: the two captures are one frame at one size');
  const { width, height } = overBlack, out = blank(width, height), B = overBlack.data, W = overWhite.data, O = out.data;
  for (let i = 0; i < O.length; i += 4) {
    // the background's share of the pixel: how far it moved between black and white, averaged over the channels
    const moved = ((W[i] - B[i]) + (W[i + 1] - B[i + 1]) + (W[i + 2] - B[i + 2])) / (3 * 255);
    const a = 1 - (moved < 0 ? 0 : moved > 1 ? 1 : moved);
    if (a <= 1 / 255) continue;
    // over black the pixel is colour × alpha: divided back out
    O[i] = clamp8(B[i] / a); O[i + 1] = clamp8(B[i + 1] / a); O[i + 2] = clamp8(B[i + 2] / a); O[i + 3] = clamp8(a * 255);
  }
  return out;
}

/**
 * Where a crop to the alpha falls in the frame: { x, y, w, h } in its pixels, `pad` kept round it (so x and y may be
 * negative); null when there is nothing. The live stage frames the same window of the same camera (front-stage-page.js).
 */
export function trimRect(img, { pad = 0, threshold = 8 } = {}) {
  const { width, height, data } = img;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > threshold) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 1 + 2 * pad, h: y1 - y0 + 1 + 2 * pad };
}

/** Crop to where the alpha is (above `threshold`), keeping `pad` transparent pixels round it. An empty image stays 1×1. */
export function trimmed(img, { pad = 0, threshold = 8 } = {}) {
  const { width, data } = img, R = trimRect(img, { pad, threshold });
  if (!R) return blank(1, 1);
  const x0 = R.x + pad, y0 = R.y + pad, x1 = x0 + R.w - 2 * pad - 1, y1 = y0 + R.h - 2 * pad - 1;
  const w = R.w, h = R.h, out = blank(w, h);
  for (let y = y0; y <= y1; y++) {
    const from = (y * width + x0) * 4, to = ((y - y0 + pad) * w + pad) * 4;
    out.data.set(data.subarray(from, from + (x1 - x0 + 1) * 4), to);
  }
  return out;
}

// the alpha grown by r pixels (a square's max, run along the rows and then the columns)
function grown(img, r) {
  const { width, height, data } = img, a = new Uint8ClampedArray(width * height), row = new Uint8ClampedArray(width * height);
  for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let m = 0;
    for (let k = Math.max(0, x - r); k <= Math.min(width - 1, x + r); k++) { const v = a[y * width + k]; if (v > m) m = v; }
    row[y * width + x] = m;
  }
  const out = new Uint8ClampedArray(width * height);
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
    let m = 0;
    for (let k = Math.max(0, y - r); k <= Math.min(height - 1, y + r); k++) { const v = row[k * width + x]; if (v > m) m = v; }
    out[y * width + x] = m;
  }
  return out;
}

// the subject drawn over a fill (straight alpha: the subject's own alpha over the fill's)
function over(img, fillAlpha, rgb) {
  const out = blank(img.width, img.height), S = img.data, O = out.data;
  for (let i = 0, p = 0; i < O.length; i += 4, p++) {
    const sa = S[i + 3] / 255, fa = fillAlpha[p] / 255, oa = sa + fa * (1 - sa);
    if (oa <= 0) continue;
    for (let c = 0; c < 3; c++) O[i + c] = clamp8((S[i + c] * sa + rgb[c] * fa * (1 - sa)) / oa);
    O[i + 3] = clamp8(oa * 255);
  }
  return out;
}

// each pixel's colour remade from its own (its alpha kept)
function recolour(img, fn) {
  const out = blank(img.width, img.height), S = img.data, O = out.data;
  for (let i = 0; i < O.length; i += 4) {
    if (!S[i + 3]) continue;
    const [r, g, b] = fn(S[i], S[i + 1], S[i + 2], (i >> 2) % img.width, Math.floor((i >> 2) / img.width));
    O[i] = r; O[i + 1] = g; O[i + 2] = b; O[i + 3] = S[i + 3];
  }
  return out;
}

const mix = (a, b, t) => [0, 1, 2].map((c) => clamp8(a[c] + (b[c] - a[c]) * t));
// how wide a rim or a dot screen is, by the picture's height (so a plate reads the same at any capture size)
const scaleOf = (img, f, least) => Math.max(least, Math.round(img.height * f));
// the subject's own range of light (its 2nd to its 98th part, over the pixels it covers): a dark figure and a pale one
// both reach from shadow to light once stretched over it
function lightRange(img) {
  const hist = new Uint32Array(256), D = img.data;
  let n = 0;
  for (let i = 0; i < D.length; i += 4) if (D[i + 3] > 127) { hist[Math.round(luma(D[i], D[i + 1], D[i + 2]) * 255)]++; n++; }
  if (!n) return [0, 1];
  const at = (q) => { let c = 0; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= q * n) return v / 255; } return 1; };
  const lo = at(0.02), hi = at(0.98);
  return hi - lo < 0.04 ? [Math.max(0, lo - 0.02), Math.min(1, hi + 0.02)] : [lo, hi];
}
const stretch = ([lo, hi]) => (l) => Math.min(1, Math.max(0, (l - lo) / (hi - lo)));
// a pixel taken to a band of light with its own hue kept (its colour scaled; a black one goes grey)
const banded = (r, g, b, l, bands) => {
  const q = (Math.min(bands - 1, Math.floor(l * bands)) + 0.5) / bands, L = luma(r, g, b);
  if (L < 0.02) return [clamp8(q * 255), clamp8(q * 255), clamp8(q * 255)];
  const k = q / L;
  return [clamp8(r * k), clamp8(g * k), clamp8(b * k)];
};
const darker = (a, b) => (luma(...hexRgb(a)) <= luma(...hexRgb(b)) ? a : b);

export const TREATMENT_FNS = Object.freeze({
  // the subject as captured, a rim of the accent round it
  cutout: (img, { accent }) => over(img, grown(img, scaleOf(img, 0.006, 2)), hexRgb(accent)),
  // the shape alone, filled with the ink
  silhouette: (img, { ink }) => { const k = hexRgb(ink); return recolour(img, () => k); },
  // its light and shade in two colours, over its own range: the accent in the shadows, the ink in the light
  duotone: (img, { ink, accent }) => {
    const lo = hexRgb(accent), hi = hexRgb(ink), s = stretch(lightRange(img));
    return recolour(img, (r, g, b) => mix(lo, hi, s(luma(r, g, b))));
  },
  // four flat bands of its own light, each pixel's hue kept
  posterize: (img) => { const s = stretch(lightRange(img)); return recolour(img, (r, g, b) => banded(r, g, b, s(luma(r, g, b)), 4)); },
  // a dot screen: dots of the ink on the accent, a dot as large as the cell under it is lit
  halftone: (img, { ink, accent }) => {
    const cell = scaleOf(img, 0.012, 4), k = hexRgb(ink), A = hexRgb(accent), { width, height, data } = img, s = stretch(lightRange(img));
    const cols = Math.ceil(width / cell), lit = new Float32Array(cols * Math.ceil(height / cell));
    for (let cy = 0; cy * cell < height; cy++) for (let cx = 0; cx * cell < width; cx++) {
      let sum = 0, n = 0;
      for (let y = cy * cell; y < Math.min(height, (cy + 1) * cell); y++) for (let x = cx * cell; x < Math.min(width, (cx + 1) * cell); x++) {
        const i = (y * width + x) * 4; if (data[i + 3]) { sum += s(luma(data[i], data[i + 1], data[i + 2])); n++; }
      }
      lit[cy * cols + cx] = n ? sum / n : 0;
    }
    return recolour(img, (r, g, b, x, y) => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), d = lit[cy * cols + cx];
      const rad = 0.5 * cell * Math.min(1.25, 0.18 + Math.sqrt(d) * 1.1), dx = x - (cx + 0.5) * cell, dy = y - (cy + 0.5) * cell;
      return dx * dx + dy * dy <= rad * rad ? k : A;
    });
  },
  // an inked line where its light or its outline turns sharply, over three bands of its own light; the line drawn in
  // the darker of the game's ink and ground, so it reads against the fill
  ink: (img, { ink, bg }) => {
    const { width, height, data } = img, L = new Float32Array(width * height), k = hexRgb(darker(ink, bg)), s = stretch(lightRange(img));
    for (let i = 0; i < L.length; i++) L[i] = data[i * 4 + 3] ? s(luma(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) * (data[i * 4 + 3] / 255) : 0;
    const at = (x, y) => L[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
    const aAt = (x, y) => data[(Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))) * 4 + 3] / 255;
    return recolour(img, (r, g, b, x, y) => {
      const gx = at(x + 1, y) - at(x - 1, y), gy = at(x, y + 1) - at(x, y - 1);
      const ax = aAt(x + 1, y) - aAt(x - 1, y), ay = aAt(x, y + 1) - aAt(x, y - 1);
      if (Math.hypot(gx, gy) > 0.22 || Math.hypot(ax, ay) > 0.45) return k;
      return banded(r, g, b, s(luma(r, g, b)), 3);
    });
  },
});
for (const t of STAGE_TREATMENTS) if (!TREATMENT_FNS[t]) throw new Error(`front-treatments: no treatment '${t}'`);

/** One treatment over a cut-out subject, in the game's colours. */
export function treat(img, treatment, colours = {}) {
  const fn = TREATMENT_FNS[treatment];
  if (!fn) throw new Error(`front-treatments: '${treatment}' is not a treatment (${STAGE_TREATMENTS.join(', ')})`);
  return fn(img, { ink: colours.ink || '#ffffff', accent: colours.accent || '#ffcc33', bg: colours.bg || '#000000' });
}
