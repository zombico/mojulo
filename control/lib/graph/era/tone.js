/**
 * TONE — colour as its own concern. A tile is drawn for its VALUE (its light and dark: the bond, the mortar's shadow,
 * the wear), and the art direction says what colours those values become. A room-kit stage's `tone`:
 *
 *   tone: 'noir' | 'flat' | 'isekai' | {
 *     texture: 'value' | 'shade',   // the tile as its greys, or as its shadow only (flat colour, the joints still dark)
 *     steps: 0 | 2…8,               // 0: the ramp's colours blend; n: n hard bands (a limited palette, a graphic look)
 *     key: 0.1…0.9,                 // where the place's middle light lands on the ramp (noir low, a sunny look high)
 *     gain: 0.5…2,                  // exposure over that: the build measures the place's baked light and sets the page's
 *                                   // gain so its median lands on `key`, then times this
 *     detail: 0…1,                  // how far a tile's own light and dark move its colour inside a band (default 0.45)
 *     ramps: { name: [5 × '#rrggbb'] },   // shadow → light
 *     groups: { 'stage:floor': name, … }, // which ramp a surface takes; the rest take `default`
 *     default: name,
 *     keep: ['stage:fixture', …],         // surfaces left as built (the torches' flames: the one warm accent)
 *   }
 *
 * The page lights first and colours after (channels/tone.js): the lit value of each pixel picks its colour off the
 * surface's ramp, so darkness is the ramp's deepest colour, never black. Here the build only drains the colour out:
 * tinted faces are baked grey (their luminance), tiles are swapped for their `value:` / `shade:` twins (greyscale
 * PNGs, a third of the bytes). Exports carry that grey build and the tone as data; colouring them is the engine's.
 * Absent `tone` ⇒ nothing here runs.
 */
import zlib from 'node:zlib';
import { registerTextureResolver, surfaceTexture, encodePngGrey } from '../landscape/surface-textures.js';

const HEX = /^#[0-9a-f]{6}$/i;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// ── presets: three directions that only colour can tell apart ─────────────────────────────────────────────────
export const TONE_PRESETS = Object.freeze({
  // hard-boiled: three values of one cold blue-grey, the torches the only warm thing in the place
  noir: { texture: 'value', steps: 3, key: 0.34, gain: 1, default: 'night', ramps: { night: ['#07090d', '#1b222c', '#3d4855', '#8794a3', '#dfe6ee'] }, keep: ['stage:fixture'] },
  // modern and flat: the tiles' shadows only, four bands, each surface its own quiet colour
  flat: {
    texture: 'shade', steps: 4, key: 0.55, gain: 1, default: 'wall',
    ramps: { wall: ['#2b2f3a', '#4a5262', '#7d8799', '#b9c1cc', '#e9edf1'], floor: ['#3a2c26', '#6b4f42', '#9c7a66', '#c9a892', '#efd9c6'], trim: ['#1f3a3a', '#2f5d5b', '#4f8a85', '#8cbcb4', '#d6ece7'], accent: ['#4a1f22', '#8a3236', '#c4534f', '#e89a86', '#fbe1d6'] },
    groups: { 'stage:floor': 'floor', 'stage:earth': 'floor', 'stage:litter': 'floor', 'stage:crack': 'floor', 'stage:trim': 'trim', 'stage:motif-band': 'trim', 'stage:accent': 'accent', 'stage:focus': 'accent', 'stage:focus-lid': 'accent', 'stage:focus-dais': 'trim',
      'stage:grass': 'trim', 'stage:vine': 'trim', 'stage:creep': 'trim', 'stage:ivy': 'trim', 'stage:moss': 'trim', 'stage:fungus': 'floor' },
    keep: ['stage:fixture'],
  },
  // isekai: bright, saturated and cel-banded, the stone lilac, the floor warm, the moss and the wood singing
  isekai: {
    texture: 'value', steps: 5, key: 0.6, gain: 1, default: 'stone',
    ramps: { stone: ['#2a1f4a', '#55479a', '#8f7fd6', '#c7b8f5', '#fff4ff'], floor: ['#3b2216', '#7a4a2a', '#c9874a', '#f2c27a', '#fff2cf'], trim: ['#14324a', '#1f6a8a', '#3fa6c4', '#8fe0ea', '#efffff'], green: ['#10301c', '#1f6a34', '#4fae4a', '#a6e070', '#f3ffd2'] },
    groups: { 'stage:floor': 'floor', 'stage:earth': 'floor', 'stage:litter': 'floor', 'stage:crack': 'floor', 'stage:trim': 'trim', 'stage:motif-band': 'trim', 'stage:prop': 'floor', 'stage:prop-doodad': 'floor',
      'stage:moss': 'green', 'stage:ivy': 'green', 'stage:grass': 'green', 'stage:vine': 'green', 'stage:creep': 'green', 'stage:fungus': 'floor' },
    keep: ['stage:fixture'],
  },
});
export const TONE_IDS = Object.keys(TONE_PRESETS);

/** A recipe's `tone` (a preset id, or a preset id's fields overridden, or a whole direction) → the resolved tone. */
export function readTone(t) {
  const base = typeof t === 'string' ? TONE_PRESETS[t] : t && typeof t === 'object' ? (t.preset ? TONE_PRESETS[t.preset] : {}) : null;
  if (!base) throw new Error(`stage: tone is one of ${TONE_IDS.join(', ')}, or { texture, steps, gain, ramps, groups, default, keep }`);
  const o = typeof t === 'object' ? t : {};
  const T = { ...base, ...o, ramps: { ...(base.ramps || {}), ...(o.ramps || {}) }, groups: { ...(base.groups || {}), ...(o.groups || {}) } };
  delete T.preset;
  if (!['value', 'shade'].includes(T.texture)) throw new Error("stage: tone.texture is 'value' (the tile's greys) or 'shade' (its shadow only)");
  if (!(T.steps === 0 || (Number.isInteger(T.steps) && T.steps >= 2 && T.steps <= 8))) throw new Error('stage: tone.steps is 0 (blended) or a whole number of bands from 2 to 8');
  if (!(typeof T.gain === 'number' && T.gain >= 0.5 && T.gain <= 2)) throw new Error('stage: tone.gain is a number from 0.5 to 2 (exposure over the measured light)');
  if (!(typeof T.key === 'number' && T.key >= 0.1 && T.key <= 0.9)) throw new Error('stage: tone.key is a number from 0.1 to 0.9 (where the middle light lands on the ramp)');
  for (const [k, r] of Object.entries(T.ramps)) if (!Array.isArray(r) || r.length !== 5 || !r.every((h) => HEX.test(h))) throw new Error(`stage: tone ramp '${k}' is five #rrggbb colours, shadow to light`);
  if (!T.ramps[T.default]) throw new Error(`stage: tone.default names a ramp (${Object.keys(T.ramps).join(', ')})`);
  for (const [g, k] of Object.entries(T.groups)) if (!T.ramps[k]) throw new Error(`stage: tone.groups['${g}'] names ramp '${k}', which tone.ramps lacks`);
  if (T.detail === undefined) T.detail = 0.45;
  if (!(typeof T.detail === 'number' && T.detail >= 0 && T.detail <= 1)) throw new Error('stage: tone.detail is a number from 0 to 1');
  T.keep = Array.isArray(T.keep) ? T.keep.filter((g) => typeof g === 'string') : [];
  return T;
}

/** A colour through a ramp at value t (0 shadow … 1 light), blended between stops. */
export function rampAt(ramp, t) {
  const c = ramp.map(hexRgb), x = Math.max(0, Math.min(1, t)) * (c.length - 1), i = Math.min(c.length - 2, Math.floor(x)), f = x - i;
  return c[i].map((v, k) => v + (c[i + 1][k] - v) * f);
}

/**
 * Drain the colour out of a face list for a tone: a tinted face is baked grey, a tile becomes its value or shade twin;
 * a `keep` surface is left as built. Before the bake.
 */
export function drainFaces(faces, T) {
  const keep = new Set(T.keep);
  // a BLEND (moss, grime, earth: a face laid over another with alpha) is a stain, not a surface: kept within reach of
  // the surfaces' own grey, or a few hard bands would cut it out as a hole
  const blend = (f) => f.alpha !== undefined || f.cornerAlpha !== undefined;
  const greys = faces.filter((f) => f.tint && !blend(f) && !keep.has(f.group)).map((f) => lum(f.tint)).sort((a, b) => a - b);
  const floor = greys.length ? 0.7 * greys[Math.floor(greys.length / 2)] : 0;
  return faces.map((f) => {
    if (keep.has(f.group)) return f;
    const g = f.tint ? (blend(f) ? Math.max(floor, lum(f.tint)) : lum(f.tint)) : null;
    const tex = typeof f.texture === 'string' && !f.texture.startsWith('value:') && !f.texture.startsWith('shade:') ? `${T.texture}:${f.texture}` : f.texture;
    return g === null && tex === f.texture ? f : { ...f, ...(g !== null ? { tint: [g, g, g] } : {}), ...(tex !== f.texture ? { texture: tex } : {}) };
  });
}

/** The page's gain for a baked face list: the median lit value (as the page reads it, gamma-encoded) brought to `key`. */
export function exposureOf(faces, T) {
  const keep = new Set(T.keep), v = [];
  for (const f of faces) {
    if (keep.has(f.group) || typeof f.fill !== 'string' || !HEX.test(f.fill)) continue;
    v.push(Math.pow(lum(hexRgb(f.fill)) ** 2.2, 1 / 2.2));
  }
  v.sort((a, b) => a - b);
  const mid = v.length ? Math.max(0.02, v[Math.floor(v.length / 2)]) : 0.5;
  return +((T.key / mid) * T.gain).toFixed(4);
}

/** The tone as the page reads it (channels/tone.js): ramps as sRGB triples, a group → ramp index map; `gain` measured
 *  by exposureOf. */
export function tonePageSpec(T, gain = T.gain) {
  const names = Object.keys(T.ramps);
  return {
    // a value tile averages about half; a shade tile's face is near white, only its joints dark
    steps: T.steps, gain, mid: T.texture === 'shade' ? 0.9 : 0.5, detail: T.detail, ramps: names.map((n) => T.ramps[n].map((h) => hexRgb(h).map((v) => +v.toFixed(4)))),
    def: names.indexOf(T.default), groups: Object.fromEntries(Object.entries(T.groups).map(([g, n]) => [g, names.indexOf(n)])), keep: T.keep,
  };
}

// ── greyscale twins of the tiles ──────────────────────────────────────────────────────────────────────────────
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
/** Decode an 8-bit, non-interlaced PNG data URL (grey, grey+alpha, RGB or RGBA) → { px: RGBA bytes, W, H } | null. */
export function decodePng(url) {
  if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) return null;
  const buf = Buffer.from(url.slice(22), 'base64');
  let p = 8, W = 0, H = 0, depth = 0, type = 0, inter = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (t === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    p += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || !ch || inter) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = W * ch, px = Buffer.alloc(W * H * 4), prev = Buffer.alloc(stride), row = Buffer.alloc(stride);
  for (let y = 0; y < H; y++) {
    const o = y * (stride + 1), ft = raw[o];
    for (let i = 0; i < stride; i++) {
      const x = raw[o + 1 + i], a = i >= ch ? row[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      row[i] = (ft === 0 ? x : ft === 1 ? x + a : ft === 2 ? x + b : ft === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 255;
    }
    for (let i = 0; i < W; i++) {
      const s = i * ch, q = (y * W + i) * 4;
      if (ch <= 2) { px[q] = px[q + 1] = px[q + 2] = row[s]; px[q + 3] = ch === 2 ? row[s + 1] : 255; }
      else { px[q] = row[s]; px[q + 1] = row[s + 1]; px[q + 2] = row[s + 2]; px[q + 3] = ch === 4 ? row[s + 3] : 255; }
    }
    row.copy(prev);
  }
  return { px, W, H, alpha: ch === 2 || ch === 4 };
}

/** A tile's greys: its luminance as is ('value'), or divided by its own light level so only what is darker than the
 *  tile's face stays ('shade': the joints, the shadow, the pits; the faces read flat). → a greyscale PNG data URL. */
export function greyTwin(url, mode) {
  const d = decodePng(url);
  if (!d) return null;
  const n = d.W * d.H, g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = lum([d.px[i * 4], d.px[i * 4 + 1], d.px[i * 4 + 2]]);
  let scale = 1;
  if (mode === 'shade') {
    // the face's level: the 70th percentile of the opaque texels (the joints and pits are the darker few)
    const vals = []; for (let i = 0; i < n; i++) if (d.px[i * 4 + 3] > 127) vals.push(g[i]);
    vals.sort((a, b) => a - b);
    scale = vals.length ? 235 / Math.max(1, vals[Math.floor(vals.length * 0.7)]) : 1;
  }
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) out[i] = Math.max(0, Math.min(255, Math.round(g[i] * scale)));
  const alpha = d.alpha ? Buffer.from(Array.from({ length: n }, (_, i) => d.px[i * 4 + 3])) : null;
  return `data:image/png;base64,${encodePngGrey(out, d.W, d.H, alpha).toString('base64')}`;
}

const twins = new Map();
for (const mode of ['value', 'shade']) {
  registerTextureResolver(`${mode}:`, (key) => {
    if (!twins.has(key)) twins.set(key, greyTwin(surfaceTexture(key.slice(mode.length + 1)), mode));
    return twins.get(key);
  });
}
