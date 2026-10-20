/**
 * A ROCK FACE TILE — the matte painter's periodic mode, for a surface too big to paint whole (a cliff): a `w` × `h` m
 * tile that repeats seamlessly both ways, painted as a DETAIL texture the World multiplies over the land's own vertex
 * colour. The vertex keeps what the land computes (its palette's rock ramp, the facet light, crevice and ridge); the
 * texel is only the relief's light and the grain's ratio to its rock's mean, scaled by `mean` so the page's multiply has
 * room above it (the land lifts its rock's vertex colour by 1/mean, in linear light, so the average stays where it was).
 *
 * The relief, in layers (each opt-out with false):
 *   beds    courses of jittered thickness summing to the tile's height: a soft bed recessed `recess` m behind the
 *           hard ones, the step between eased; a hard bed stands proud, its top lip rounded `lip` m
 *   joints  vertical breaks about `spacing` m apart, offset course by course (`width`, `depth` m): each block between
 *           them a plane of its own tilted by up to `tilt` (big breaks are planar: the rock field's lesson)
 *   rough   the face's unevenness (`amp` m at `scale` m) and a fine `grain` (m)
 *   streak  water stains run down from each hard bed's lip over the bed below, by up to `amount`
 * `grit` (0–1) scales the joints' depth, the tilt, the roughness and the stains. Grain colour comes from the rock field
 * (polygonizer/rock-fracture.js `colorAt`) on the tile's plane, filtered to a texel.
 *
 * Seamless: the beds and joints are periodic by construction; every noise is cross-faded into its own copy one tile over
 * across the last quarter of the tile, so the tile meets itself at both edges. The light (light.js) wraps at the edges.
 *
 *   paintRockTile(spec) → { W, H, png, url, mean }
 *   readRockTile(spec)  → the spec, checked and filled
 *
 * Pure: seeded dice only. The bytes a spec paints are a promise.
 */
import { gnoise2, fractal2, smoothstep } from '../noise/noise.js';
import { encodePng } from '../landscape/surface-textures.js';
import { rockField } from '../polygonizer/rock-fracture.js';
import { ROCK_PRESETS } from '../polygonizer/rock-minerals.js';
import { dice, hash01 } from './relief.js';
import { lightRelief } from './light.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`matte tile: ${m}`); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (lo, hi) => ({ lo, hi }), int = (lo, hi) => ({ lo, hi, int: true });

export const ROCK_TILE_RAILS = Object.freeze({
  top: { w: num(0.5, 8), h: num(0.5, 8), ppm: int(16, 256), grit: num(0, 1), seed: int(1, 99999), mean: num(0.4, 0.95), contrast: num(0, 2), grain: num(0, 1) },
  beds: { count: int(1, 16), jitter: num(0, 0.7), soft: num(0, 1), recess: num(0, 0.2), lip: num(0, 0.1) },
  joints: { spacing: num(0.1, 4), width: num(0.005, 0.15), depth: num(0, 0.2), tilt: num(0, 1) },
  rough: { amp: num(0, 0.05), scale: num(0.05, 2), grain: num(0, 0.01) },
  streak: { amount: num(0, 1) },
});
export const ROCK_TILE_DEFAULTS = Object.freeze({
  w: 6, h: 6, ppm: 64, grit: 0.6, seed: 1, mean: 0.72, contrast: 0.85, grain: 0.6, rock: 'granite',
  beds: { count: 4, jitter: 0.5, soft: 0.35, recess: 0.12, lip: 0.04 },
  joints: { spacing: 1.8, width: 0.06, depth: 0.1, tilt: 0.6 },
  rough: { amp: 0.025, scale: 0.8, grain: 0.002 },
  streak: { amount: 0.5 },
});
const LIGHT = { az: 135, el: 38, ambient: 0.35, wrap: 0.2, reach: 0.5, soft: 0.012, floor: 0.35, radius: 0.08, cavity: 0.45, edge: 0.1 };

function check(v, r, at) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < r.lo || v > r.hi || (r.int && !Number.isInteger(v))) no(`${at} is ${r.int ? 'a whole number' : 'a number'} from ${r.lo} to ${r.hi}`);
  return v;
}
/** The spec, checked and filled. */
export function readRockTile(spec = {}) {
  if (!isObj(spec)) no('a rock tile is { w?, h?, ppm?, grit?, seed?, rock?, beds?, joints?, rough?, streak?, light? }');
  const layers = Object.keys(ROCK_TILE_RAILS).filter((k) => k !== 'top');
  for (const k of Object.keys(spec)) if (!ROCK_TILE_RAILS.top[k] && !layers.includes(k) && k !== 'rock' && k !== 'light') no(`${k} is not part of a rock tile`);
  const out = {};
  for (const [k, r] of Object.entries(ROCK_TILE_RAILS.top)) out[k] = spec[k] === undefined ? ROCK_TILE_DEFAULTS[k] : check(spec[k], r, k);
  out.rock = spec.rock ?? ROCK_TILE_DEFAULTS.rock;
  if (typeof out.rock === 'string' && !ROCK_PRESETS[out.rock]) no(`rock is a rock preset (${Object.keys(ROCK_PRESETS).join(', ')}) or { modes, grain, colors? }`);
  for (const L of layers) {
    const v = spec[L] === undefined ? ROCK_TILE_DEFAULTS[L] : spec[L];
    if (v === false) { out[L] = false; continue; }
    if (!isObj(v)) no(`${L} is a layer { … } or false`);
    for (const k of Object.keys(v)) if (!ROCK_TILE_RAILS[L][k]) no(`${L}.${k} is not a setting (${Object.keys(ROCK_TILE_RAILS[L]).join(', ')})`);
    out[L] = { ...ROCK_TILE_DEFAULTS[L] };
    for (const [k, r] of Object.entries(ROCK_TILE_RAILS[L])) if (v[k] !== undefined) out[L][k] = check(v[k], r, `${L}.${k}`);
  }
  out.light = { ...LIGHT, ...(isObj(spec.light) ? spec.light : {}) };
  const W = Math.round(out.w * out.ppm), H = Math.round(out.h * out.ppm);
  if (W > 1024 || H > 1024) no(`the tile is ${W}×${H} texels; at most 1024 a side`);
  return out;
}

// a noise made periodic: crossed into its own copy one tile over across the last quarter of each axis
const seamless = (f, w, h) => (x, y) => {
  const a = smoothstep(0.75 * w, w, x), b = smoothstep(0.75 * h, h, y);
  const v0 = a > 0 ? f(x, y) * (1 - a) + f(x - w, y) * a : f(x, y);
  if (b <= 0) return v0;
  const v1 = a > 0 ? f(x, y - h) * (1 - a) + f(x - w, y - h) * a : f(x, y - h);
  return v0 * (1 - b) + v1 * b;
};

/** The rock face's height field, periodic: { field: { W, H, px, height, inside, wrap: true }, below } (`below`: how far
 * under a hard bed's lip each texel lies, metres, or −1). Nature, not masonry: each bed's boundary wavers along the
 * face, a bed's joints fall at their own jittered places and wander as they go down, some stop short, and each block
 * between them is its own tilted, fractured plane. */
function faceField(S) {
  const { w, h, ppm, grit, seed } = S, W = Math.round(w * ppm), H = Math.round(h * ppm), px = 1 / ppm, R = dice(seed * 4241 + 7);
  const B = S.beds, nb = B ? B.count : 1, th = Array.from({ length: nb }, () => 1 + (R() * 2 - 1) * (B ? B.jitter : 0)), sum = th.reduce((a, b) => a + b, 0);
  const beds = []; let y0 = 0;
  for (let b = 0; b < nb; b++) { const t = (th[b] / sum) * h; beds.push({ y0, y1: y0 + t, soft: !!B && R() < B.soft }); y0 += t; }
  // each boundary's waver along the face (periodic in x), up to a fifth of the thinner bed it parts
  const waver = beds.map((bd, b) => { const amp = 0.2 * Math.min(bd.y1 - bd.y0, beds[(b + 1) % nb].y1 - beds[(b + 1) % nb].y0); return seamless((x) => gnoise2(x / 0.7, b * 3.7, seed + 13) * amp, w, 1e9); });
  // each bed's joints: jittered places round the tile (periodic), each with its own wander and its own reach down the bed
  const J = S.joints, joints = beds.map(() => {
    if (!J) return [];
    const n = Math.max(1, Math.round(w / J.spacing)), off = R() * w;
    return Array.from({ length: n }, (_, k) => ({ x: (off + ((k + 0.5 + (R() - 0.5) * 0.7) * w) / n) % w, reach: R() < 0.3 ? 0.35 + 0.5 * R() : 1, wid: J.width * (0.6 + 0.8 * R()), s: Math.floor(R() * 1e6) })).sort((a, c) => a.x - c.x);
  });
  const Rg = S.rough;
  const rough = Rg ? seamless((x, y) => fractal2(x / Rg.scale, y / Rg.scale, { seed: seed + 5, octaves: 4 })[0] * Rg.amp + fractal2(x / 0.02, y / 0.02, { seed: seed + 7, octaves: 2 })[0] * Rg.grain, w, h) : null;
  const fracture = seamless((x, y) => fractal2(x / 0.12, y / 0.12, { seed: seed + 11, octaves: 3, flavour: 'ridged' })[0], w, h);
  const height = new Float32Array(W * H), inside = new Float32Array(W * H).fill(1), below = new Float32Array(W * H).fill(-1);
  for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, cut = beds.map((bd, b) => bd.y1 + waver[b](x, 0));
    for (let j = 0; j < H; j++) {
      const y = (j + 0.5) * px, k = j * W + i;
      // the bed this texel is in, by the wavering boundaries (the last bed wraps to the first)
      let bi = cut.findIndex((c) => y < c); if (bi < 0) bi = 0;
      const top = bi === 0 ? cut[nb - 1] - h : cut[bi - 1], bd = beds[bi], tall = cut[bi] - top, t = (y - top) / tall, over = beds[(bi - 1 + nb) % nb];
      let z = 0;
      if (B) {
        // a soft bed steps back over a few centimetres at its top and its foot; a hard bed's top lip is rounded
        const tr = Math.min(0.06, 0.3 * tall) / tall;
        if (bd.soft) z -= B.recess * smoothstep(0, tr, t) * (1 - smoothstep(1 - tr, 1, t));
        else z -= B.lip * (1 - smoothstep(0, Math.min(0.5, (2 * B.lip) / tall), t));
        below[k] = over.soft ? -1 : y - top;
      }
      if (J) {
        // the nearest joint in this bed (round the tile), wandering as it goes down; a short one fades out
        const js = joints[bi]; let dj = Infinity, left = js[js.length - 1].x - w, block = js.length - 1;
        for (let q = 0; q < js.length; q++) {
          const jt = js[q], jx = jt.x + gnoise2(y / 0.25, q * 5.3, seed + jt.s % 997) * 0.06;
          for (const xx of [jx - w, jx, jx + w]) { const d = Math.abs(x - xx); if (d < dj && t <= jt.reach) dj = d; }
          if (x >= jx) { left = jx; block = q; }
        }
        const jw = js[block].wid;
        if (dj < jw) z -= J.depth * (0.4 + 0.6 * grit) * (1 - dj / jw);
        // the block's own plane, tilted about its middle, and its fractured skin
        const right = block + 1 < js.length ? js[block + 1].x : js[0].x + w, u = (x - left) / Math.max(0.05, right - left);
        const gx = (hash01(block, bi, seed + 31) - 0.5) * 2, gy = (hash01(block, bi, seed + 37) - 0.5) * 2;
        z += J.tilt * grit * 0.1 * ((u - 0.5) * gx + (t - 0.5) * gy) + fracture(x, y) * 0.02 * grit;
      }
      if (rough) z += rough(x, y) * (0.35 + 0.65 * grit);
      height[k] = z;
    }
  }
  return { field: { W, H, px, height, inside, wrap: true }, beds, below };
}

export function paintRockTile(spec = {}) {
  const S = readRockTile(spec), { field, below } = faceField(S), { W, H, px } = field;
  const lit = lightRelief(field, S.light);
  const rf = rockField({ size: 2, unit: 'm', rock: S.rock, seed: S.seed, octaves: 0 }), mean = [1, 3, 5].map((o) => parseInt(rf.meanColor.slice(o, o + 2), 16));
  const ratioAt = (x, y) => { const c = rf.colorAt([x, -1, y], px); return [1, 3, 5].map((o, q) => parseInt(c.slice(o, o + 2), 16) / (mean[q] || 1)); };
  const srgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
  const out = Buffer.alloc(W * H * 3), Sk = S.streak, stain = seamless((x, y) => gnoise2(x / 0.05, y / 1.2, S.seed + 61), S.w, S.h);
  let acc = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, x = (i + 0.5) * px, y = (j + 0.5) * px;
    // the grain's ratio, crossed into its copy one tile over at the edges like every noise
    const a = smoothstep(0.75 * S.w, S.w, x), b = smoothstep(0.75 * S.h, S.h, y);
    let g = ratioAt(x, y);
    if (a > 0) { const g2 = ratioAt(x - S.w, y); g = g.map((v, q) => v * (1 - a) + g2[q] * a); }
    if (b > 0) { const g3 = ratioAt(x, y - S.h); g = g.map((v, q) => v * (1 - b) + g3[q] * b); }
    let v = 1 + (lit.value[k] - 1) * S.contrast;
    if (Sk && below[k] >= 0) {
      // a stain from the lip above: long, thin, darkest just under the lip
      const s = stain(x, y), fall = 1 - smoothstep(0, 0.6, below[k]);
      v *= 1 - Sk.amount * S.grit * 0.35 * Math.max(0, s) * fall;
    }
    for (let q = 0; q < 3; q++) {
      const d = clamp(S.mean * v * (1 + (g[q] - 1) * S.grain), 0, 1);
      acc += d / 3;
      out[k * 3 + q] = Math.round(255 * srgb(d));
    }
  }
  const png = encodePng(out, W, H);
  return { W, H, png, url: `data:image/png;base64,${png.toString('base64')}`, mean: S.mean, measured: acc / (W * H) };
}
