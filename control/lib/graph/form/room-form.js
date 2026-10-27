/**
 * THE FORM RENDER INDOORS (gen-7, era/eras.js): a room's surfaces read as material and its placed lights lit live, where
 * gen-6 paints the light into each tile and bakes every lamp into the corners.
 *
 *   formMaterialOf(key) → { base, normal, orm, read } | null   one tile key's maps as PNG data URLs (glTF's metal-rough
 *                         set, form/relief-material.js): its colour under no light, its tangent-space normal, occlusion +
 *                         roughness + metalness packed. `read` says how the form was found:
 *                           'relief'     a dressed family (matte-paint/dressed.js): painted from its relief, so the
 *                                        material is the relief itself (every joint, flute and chip its own slope)
 *                           'luminance'  any other tile: its painted light read back as height (dark is low), the way the
 *                                        seventh generation's own tools pulled a normal map from a photograph; its colour
 *                                        keeps the light it was painted with, so this is an approximation and says so
 *                         null: a key no generator paints, or a cutout (a card keeps its paint)
 *   formRoomMaps(keys, { detail }) → { textures: { key: base }, maps: { key: { normal, orm, read } } }   `detail`: a toned
 *                         room's (era/tone.js), how far a twin's own light and dark move its colour
 *   readFormLight(lights) → the page's light list: each placed light at its flame, its colour 0..1, its bake intensity
 *                         and radius, and whether it may cast
 *
 * The page lights the material (scene/channels/form.js) by the bake's own law (stage.js bakeStageLight: the falloff
 * held flat inside NEAR_LIGHT, a smooth square to the radius), so a room read in gen-7 is lit as bright as its gen-6
 * paint, from live lights that find every relief. Pure: the dice are the tiles' own; memoized per key.
 */
import { dressedMaterial } from '../matte-paint/dressed.js';
import { reliefMaterial } from './relief-material.js';
import { surfaceTexture, generatedSpecOf, encodePng, SURFACE_TILING } from '../landscape/surface-textures.js';
import { decodePng } from '../era/tone.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const png = (rgb, W, H) => `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;

/** How rough each dressed cut is (the rest are stone's 0.85): wood a little less, glazed and machine faces less again. */
export const FORM_ROUGH = Object.freeze({ boards: 0.72, brick: 0.82, precast: 0.7, stucco: 0.8, tile: 0.6, slate: 0.55, pavement: 0.88 });
/** A painted tile read back as relief: metres of height a unit of luminance stands for, over a nominal metre a repeat. */
export const LUMINANCE_RELIEF = 0.006;

const cache = new Map();

export function formMaterialOf(key, { detail = 1 } = {}) {
  if (typeof key !== 'string' || key.startsWith('card:') || key.includes(':card:')) return null;
  const ck = detail === 1 ? key : `${key}|${detail}`;
  if (cache.has(ck)) return cache.get(ck);
  // a toned room's twin (era/tone.js `value:` / `shade:`): the tile's own material, its colour taken to grey (the room's
  // ramp colours it in the corners: era/stage.js formToneColour)
  const twin = /^(value|shade):/.exec(key);
  if (twin) {
    const m = formMaterialOf(key.slice(twin[0].length)), d = m && decodePng(m.base);
    const out = m && d ? { ...m, base: png(greyOf(d, detail), d.W, d.H) } : null;
    cache.set(ck, out);
    return out;
  }
  const spec = generatedSpecOf(key);
  let out = null;
  if (spec && spec.gen === 'dressed') {
    const M = dressedMaterial(spec.cfg, { size: spec.size, seed: spec.seed, rough: FORM_ROUGH[spec.cfg.cut] ?? 0.85 });
    out = { base: png(M.baseColor, M.W, M.H), normal: png(M.normal, M.W, M.H), orm: png(M.orm, M.W, M.H), read: 'relief' };
  } else {
    const d = decodePng(surfaceTexture(key));
    if (d && !d.alpha) out = luminanceMaterial(d, SURFACE_TILING[key] === 'repeat', key);
  }
  cache.set(key, out);
  return out;
}

// a painted tile's light read back as its form: the luminance's high pass is the height (a joint dark, a face proud), its
// hollows the occlusion; the colour is the paint as it was
function luminanceMaterial({ px, W, H }, tile) {
  const rgb = Buffer.alloc(W * H * 3), lum = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) {
    rgb[k * 3] = px[k * 4]; rgb[k * 3 + 1] = px[k * 4 + 1]; rgb[k * 3 + 2] = px[k * 4 + 2];
    lum[k] = (0.2126 * px[k * 4] + 0.7152 * px[k * 4 + 1] + 0.0722 * px[k * 4 + 2]) / 255;
  }
  const mean = blur(lum, W, H, Math.max(2, Math.round(W / 24)), tile), height = new Float32Array(W * H), cavity = new Float32Array(W * H), convex = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) {
    const hp = lum[k] - mean[k];
    height[k] = hp * LUMINANCE_RELIEF;
    cavity[k] = 0.5 * clamp(-hp / 0.18, 0, 1); convex[k] = clamp(hp / 0.18, 0, 1);
  }
  const M = reliefMaterial({ W, H, px: 1 / W, height, tile }, { base: rgb, cavity, convex, rough: 0.9 });
  return { base: png(M.baseColor, W, H), normal: png(M.normal, W, H), orm: png(M.orm, W, H), read: 'luminance' };
}

/** Where a toned twin's greys are centred: on the toned page a tile only moves its colour along the ramp, where a material
 *  multiplies it, so the room's colour is divided by this where a twin lies under it (era/stage.js formToneColour). */
export const TWIN_MID = 0.8;
/** How much of a twin's own light and dark a material multiplies by (under the tone's `detail`): on the toned page a texel
 *  moves its colour along a ramp whose stops are close in value, so a multiply at full contrast reads twice as hard. */
export const TWIN_CONTRAST = 0.5;

/** A toned twin's mean value as the toned page reads it (channels/tone.js `toneV`: a texel's luminance, gamma-encoded). */
export function twinMeanValue(key) {
  if (twinMeans.has(key)) return twinMeans.get(key);
  const d = decodePng(surfaceTexture(key));
  let v = null;
  if (d) { let s = 0; for (let k = 0; k < d.W * d.H; k++) s += ((0.2126 * (d.px[k * 4] / 255) ** 2.2 + 0.7152 * (d.px[k * 4 + 1] / 255) ** 2.2 + 0.0722 * (d.px[k * 4 + 2] / 255) ** 2.2)) ** 0.4545; v = s / (d.W * d.H); }
  twinMeans.set(key, v);
  return v;
}
const twinMeans = new Map();
// a decoded colour as its greys, brought to a middle of TWIN_MID (the corners carry the face's colour and value), its
// contrast the tone's `detail` (how far a tile's own light and dark move its colour, era/tone.js)
function greyOf({ px, W, H }, detail) {
  const g = new Float32Array(W * H);
  let sum = 0;
  for (let k = 0; k < W * H; k++) { g[k] = (0.2126 * px[k * 4] + 0.7152 * px[k * 4 + 1] + 0.0722 * px[k * 4 + 2]) / 255; sum += g[k]; }
  const s = 1 / Math.max(0.05, sum / (W * H)), rgb = Buffer.alloc(W * H * 3);
  for (let k = 0; k < W * H; k++) rgb[k * 3] = rgb[k * 3 + 1] = rgb[k * 3 + 2] = Math.round(clamp(TWIN_MID * (1 + (g[k] * s - 1) * detail * TWIN_CONTRAST), 0, 1) * 255);
  return rgb;
}

function blur(src, W, H, r, tile) {
  const ix = tile ? (i) => ((i % W) + W) % W : (i) => clamp(i, 0, W - 1), jx = tile ? (j) => ((j % H) + H) % H : (j) => clamp(j, 0, H - 1);
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0; for (let a = -r; a <= r; a++) s += src[j * W + ix(i + a)]; tmp[j * W + i] = s / n; }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0; for (let b = -r; b <= r; b++) s += tmp[jx(j + b) * W + i]; out[j * W + i] = s / n; }
  return out;
}

export function formRoomMaps(keys, { detail = 1 } = {}) {
  const textures = {}, maps = {};
  for (const key of [...new Set(keys)].sort()) {
    const m = formMaterialOf(key, { detail: /^(value|shade):/.test(key) ? detail : 1 });
    if (!m) continue;
    textures[key] = m.base; maps[key] = { normal: m.normal, orm: m.orm, read: m.read };
  }
  return { textures, maps };
}

const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** The placed lights as the page lights them: `at` the flame, `rgb` 0..1, the bake's `intensity` and `radius`, `cast`. */
export function readFormLight(lights) {
  return lights.map((l) => ({
    at: l.at.map(r4), rgb: (typeof l.color === 'string' ? hexToRgb(l.color) : l.color).map(r4), intensity: r4(l.intensity), radius: r4(l.radius),
    // (a pool is light a bake lays where a window or an oculus would throw it: it lights, it casts nothing)
    cast: l.fixture !== 'pool',
  }));
}
const hexToRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255); };
