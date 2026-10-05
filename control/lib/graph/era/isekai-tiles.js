/**
 * ISEKAI TILES — the pixel-locked surfaces of an isekai stage, registered as the `isekai:` resolver. A key is
 * `isekai:<style id>:<tile>-<band>`, `band` one of `lit` / `shade`; the tile is painted in LEVELS (0 = the window's
 * darkest stop) and every texel then takes its stop's colour, so a tile holds nothing but its ramp's stops — the pixel
 * lock (the style card's `tiles[tile]` names the ramp and each band's window of stops). Seamless both ways, 256 px.
 *
 *   cliff    strata: horizontal bands with wavering edges, each band lit along its top (the bench catching the sun)
 *            and dark along its foot (under the ledge), vertical joints in the darkest level
 *   rock     a boulder's side: broad blotches in two levels, a lit chip here and there, a few dark cracks
 *   hat      a grass cap seen from above: patches in three levels, short blade ticks lit and dark
 *   fringe   (RGBA) a ragged grass edge hanging from the top row: a solid band, then blades of many lengths
 *   blades   (RGBA) a tuft of broad blades from one crown, the tips the lightest level
 *   cumulus  (RGBA) a heaped cloud on a flat base: puffs along the base, cauliflower heads on top, each lit from
 *            above in three levels with the darkest along the base
 *
 * `isekaiTexture(key)` → data:image/png; `isekaiTexels(key)` → { W, H, rgb, a? } (the test reads every texel).
 * Deterministic: mulberry32 dice seeded from the key, memoized per process.
 */
import { encodePng, encodePngRgba, registerTextureResolver } from '../landscape/surface-textures.js';
import { mulberry32 } from '../vegetation/grow.js';
import { ISEKAI_MEADOW } from './style/isekai-meadow.js';

export const ISEKAI_STYLES = Object.freeze({ 'isekai-meadow': ISEKAI_MEADOW });
const SIZE = 256;
const CUTOUT = new Set(['fringe', 'blades', 'cumulus']);
const wrap = (v) => ((v % SIZE) + SIZE) % SIZE;
const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// a smooth seamless value noise at `cells` per side
function noise(R, cells) {
  const g = Array.from({ length: cells * cells }, () => R());
  return (x, y) => {
    const u = (x / SIZE) * cells, v = (y / SIZE) * cells, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const at = (a, b) => g[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
    const s = (t) => t * t * (3 - 2 * t);
    return (at(i, j) * (1 - s(fu)) + at(i + 1, j) * s(fu)) * (1 - s(fv)) + (at(i, j + 1) * (1 - s(fu)) + at(i + 1, j + 1) * s(fu)) * s(fv);
  };
}

// each painter fills `lv` (a level per texel, 0..n-1) and, for a cutout, `a` (0 / 1)
const PAINTERS = {
  cliff(lv, n, R) {
    const top = n - 1, wav = noise(R, 4), wav2 = noise(R, 9), blot = noise(R, 5);
    // band boundaries down the tile (seamless: they divide SIZE), each wavering along x
    const edges = []; let y = 0; while (y < SIZE) { edges.push(y); y += 40 + Math.floor(R() * 34); } edges.push(SIZE);
    if (SIZE - edges[edges.length - 2] < 24) edges.splice(edges.length - 2, 1);
    const base = edges.slice(0, -1).map((_, i) => (i % 2 ? Math.max(0, top - 2) : Math.max(0, top - 1)));
    for (let x = 0; x < SIZE; x++) {
      const off = Math.round((wav(x, 0) - 0.5) * 14 + (wav2(x, 7) - 0.5) * 5);
      for (let yy = 0; yy < SIZE; yy++) {
        const Y = wrap(yy - off); let b = 0; while (Y >= edges[b + 1]) b++;
        const into = Y - edges[b], left = edges[b + 1] - Y;
        let l = base[b];
        if (blot(x, yy) > 0.66) l = Math.min(top, l + 1);
        if (into < 5 + Math.round(wav2(x, b * 31) * 4)) l = top;            // the bench's lit top
        else if (left < 4) l = 0;                                            // the shadow under the ledge
        lv[yy * SIZE + x] = l;
      }
    }
    // joints: wavering vertical cracks through one band each
    for (let k = 0; k < 14; k++) {
      let x = R() * SIZE; const b = Math.floor(R() * (edges.length - 1)), y0 = edges[b] + 5, y1 = edges[b + 1] - 3;
      for (let yy = y0; yy < y1; yy++) { x += (R() - 0.5) * 1.4; for (const dx of [0, 1]) { const X = wrap(Math.round(x) + dx); const off = Math.round((wav(X, 0) - 0.5) * 14 + (wav2(X, 7) - 0.5) * 5); lv[wrap(yy + off) * SIZE + X] = 0; } }
    }
  },
  rock(lv, n, R) {
    const top = n - 1, big = noise(R, 3), mid = noise(R, 7);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const v = 0.7 * big(x, y) + 0.3 * mid(x, y);
      lv[y * SIZE + x] = v > 0.55 ? top : Math.max(0, top - 1);   // two broad levels; the darkest only in the cracks
    }
    for (let k = 0; k < 9; k++) {   // cracks: short wandering dark strokes
      let x = R() * SIZE, y = R() * SIZE, a = R() * 6.28; const len = 18 + R() * 40;
      for (let t = 0; t < len; t++) { a += (R() - 0.5) * 0.5; x += Math.cos(a); y += Math.sin(a); lv[wrap(Math.round(y)) * SIZE + wrap(Math.round(x))] = 0; lv[wrap(Math.round(y) + 1) * SIZE + wrap(Math.round(x))] = top; }
    }
  },
  hat(lv, n, R) {
    const top = n - 1, big = noise(R, 4), mid = noise(R, 11);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const v = 0.6 * big(x, y) + 0.4 * mid(x, y);
      lv[y * SIZE + x] = v > 0.62 ? top : v > 0.38 ? Math.max(0, top - 1) : Math.max(0, top - 2);
    }
    for (let k = 0; k < 900; k++) {   // blade ticks: a short stroke, lit or dark
      const x = R() * SIZE, y = R() * SIZE, a = -Math.PI / 2 + (R() - 0.5) * 1.2, len = 3 + R() * 6, l = R() < 0.55 ? top : 0;
      for (let t = 0; t < len; t++) lv[wrap(Math.round(y + Math.sin(a) * t)) * SIZE + wrap(Math.round(x + Math.cos(a) * t))] = l;
    }
  },
  // the fringe hangs from the top row (image y = 0 is the edge it hangs from)
  fringe(lv, n, R, a) {
    const top = n - 1, band = noise(R, 6);
    a.fill(0);
    for (let x = 0; x < SIZE; x++) {
      const h = 34 + Math.round(band(x, 0) * 26);
      for (let y = 0; y < h; y++) { a[y * SIZE + x] = 1; lv[y * SIZE + x] = y < 6 ? top : y > h - 7 ? 0 : Math.max(0, top - 1); }
    }
    for (let k = 0; k < 120; k++) {   // blades hanging from under the band, narrowing to a point, tips lit
      const x0 = R() * SIZE, w = 3 + R() * 6, y0 = 30 + R() * 20, len = 30 + R() * (SIZE * 0.55), bend = (R() - 0.5) * 20;
      for (let y = 0; y < len; y++) {
        const f = y / len, half = (w / 2) * (1 - f), cx = x0 + bend * f * f;
        for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
          const Y = Math.round(y0 + y); if (Y >= SIZE) continue;
          const X = wrap(x); a[Y * SIZE + X] = 1; lv[Y * SIZE + X] = f > 0.8 ? top : f < 0.3 ? 0 : Math.max(0, top - 2 + (x > cx ? 1 : 0));
        }
      }
    }
  },
  // a heaped cumulus (image y = 0 is the top): puffs whose union is the cloud, the base cut flat
  cumulus(lv, n, R, a) {
    const top = n - 1, base = SIZE * 0.9, puffs = [];
    const m = 4 + Math.floor(R() * 3);
    for (let i = 0; i < m; i++) {   // the body: along the base, biggest in the middle, heaped up
      const f = (i + 0.5) / m, r = SIZE * (0.1 + 0.14 * Math.sin(Math.PI * f)) * (0.85 + 0.3 * R());
      puffs.push([SIZE * (0.14 + 0.72 * f), base - r * 0.6, r]);
    }
    const tower = [SIZE * (0.4 + 0.2 * R()), base - SIZE * 0.42, SIZE * (0.17 + 0.05 * R())];   // the heap's crown
    puffs.push(tower);
    for (let i = 0; i < 12; i++) {   // the heads: cauliflower on the upper rim of body and crown
      const b = i < 5 ? tower : puffs[1 + Math.floor(R() * (m - 2))], ang = -Math.PI / 2 + (R() - 0.5) * 2.2, r = b[2] * (0.38 + 0.25 * R());
      puffs.push([b[0] + Math.cos(ang) * b[2] * 0.78, b[1] + Math.sin(ang) * b[2] * 0.78, r]);
    }
    a.fill(0);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (y > base) continue;
      let own = null, best = 0;
      for (const p of puffs) { const d = Math.hypot(x - p[0], y - p[1]), w = 1 - d / p[2]; if (w > best) { best = w; own = p; } }
      if (!own) continue;
      a[y * SIZE + x] = 1;
      // a crescent per puff: lit inside a circle pulled toward the light (up and a little left), shaded outside one
      // pulled away from it, so the bands curve round each puff as the era's painters drew them
      const r = own[2], lit = Math.hypot(x - (own[0] - 0.3 * r), y - (own[1] - 0.42 * r)) < 0.86 * r, dark = Math.hypot(x - (own[0] - 0.1 * r), y - (own[1] - 0.2 * r)) > 0.98 * r;
      lv[y * SIZE + x] = base - y < SIZE * 0.05 ? 0 : lit ? top : dark ? Math.max(0, top - 2) : Math.max(0, top - 1);
    }
  },
  // a tuft: blades from a crown at the bottom centre, fanned, tips lit (image y = 0 is the top)
  blades(lv, n, R, a) {
    const top = n - 1;
    a.fill(0);
    for (let k = 0; k < 26; k++) {
      const lean = (R() - 0.5) * 1.5, h = SIZE * (0.45 + 0.53 * R()), w = 7 + R() * 9, x0 = SIZE / 2 + (R() - 0.5) * 40, curl = (R() - 0.5) * 50;
      for (let t = 0; t < h; t++) {
        const f = t / h, half = (w / 2) * (1 - f * f), cx = x0 + lean * t * 0.35 + curl * f * f, Y = SIZE - 1 - Math.round(t);
        if (Y < 0) break;
        for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
          if (x < 0 || x >= SIZE) continue;
          a[Y * SIZE + x] = 1; lv[Y * SIZE + x] = f > 0.72 ? top : f < 0.22 ? 0 : x < cx ? Math.max(0, top - 2) : Math.max(0, top - 1);
        }
      }
    }
  },
};

/** Parse `isekai:<style>:<tile>-<band>` → { st, tile, band, stops } (the stops the tile may use), or null. */
export function isekaiKey(key) {
  const m = /^isekai:([a-z0-9-]+):([a-z]+)-(lit|shade)$/.exec(key || ''); if (!m) return null;
  const st = ISEKAI_STYLES[m[1]], T = st && st.tiles[m[2]];
  if (!T || !PAINTERS[m[2]]) return null;
  const ramp = st.palette[T.ramp];
  return { st, tile: m[2], band: m[3], cutout: CUTOUT.has(m[2]), stops: T[m[3]].map((i) => ramp[i]) };
}

const TEXELS = new Map();
/** The tile's texels: { W, H, rgb (Uint8Array), a (Uint8Array 0/255) | null }. */
export function isekaiTexels(key) {
  if (TEXELS.has(key)) return TEXELS.get(key);
  const K = isekaiKey(key); if (!K) return null;
  const R = mulberry32(seedOf(key.replace(/-(lit|shade)$/, ''))), lv = new Uint8Array(SIZE * SIZE), al = K.cutout ? new Uint8Array(SIZE * SIZE) : null;
  // the same dice for both bands of a tile: its lit and shade tiles are one drawing in two windows of the ramp
  PAINTERS[K.tile](lv, K.stops.length, R, al);
  const rgb = new Uint8Array(SIZE * SIZE * 3), a = al ? new Uint8Array(SIZE * SIZE) : null;
  for (let i = 0; i < SIZE * SIZE; i++) { const s = K.stops[Math.min(K.stops.length - 1, lv[i])]; rgb[i * 3] = s[0]; rgb[i * 3 + 1] = s[1]; rgb[i * 3 + 2] = s[2]; if (a) a[i] = al[i] ? 255 : 0; }
  const t = { W: SIZE, H: SIZE, rgb, a }; TEXELS.set(key, t); return t;
}

const URLS = new Map();
export function isekaiTexture(key) {
  if (URLS.has(key)) return URLS.get(key);
  const t = isekaiTexels(key); if (!t) return null;
  let url;
  if (t.a) { const rgba = new Uint8Array(SIZE * SIZE * 4); for (let i = 0; i < SIZE * SIZE; i++) { rgba[i * 4] = t.rgb[i * 3]; rgba[i * 4 + 1] = t.rgb[i * 3 + 1]; rgba[i * 4 + 2] = t.rgb[i * 3 + 2]; rgba[i * 4 + 3] = t.a[i]; } url = `data:image/png;base64,${encodePngRgba(Buffer.from(rgba), SIZE, SIZE).toString('base64')}`; }
  else url = `data:image/png;base64,${encodePng(Buffer.from(t.rgb), SIZE, SIZE).toString('base64')}`;
  URLS.set(key, url); return url;
}

/** A cutout's alpha as the sun bake reads a card's ({ W, H, a }), or null. */
export function isekaiMask(key) { const t = isekaiTexels(key); return t && t.a ? { W: t.W, H: t.H, a: t.a } : null; }

registerTextureResolver('isekai:', isekaiTexture);
