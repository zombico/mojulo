/**
 * THE FORM RENDER INDOORS (gen-7, era/eras.js): a room's surfaces read as material, its light solved from its palette and
 * baked apart from its colour (form/room-light.js), where gen-6 paints the light into each tile and into the corners.
 *
 *   formMaterialOf(key) → { base, normal, orm, read } | null   one tile key's maps as PNG data URLs (glTF's metal-rough
 *                         set, form/relief-material.js): its colour under no light, its tangent-space normal, occlusion +
 *                         roughness + the relief's height packed (PARALLAX: the page marches it near the eye), its
 *                         `depth` (that height's range, a repeat being 1) and its `mean` colour (linear: the page divides
 *                         the colour by it, so the solved base sets the hue and the tile carries the detail). `read` says
 *                         how the form was found:
 *                           'relief'     a dressed family (matte-paint/dressed.js): painted from its relief, so the
 *                                        material is the relief itself (every joint, flute and chip its own slope)
 *                           'luminance'  any other tile: its painted light read back as height (dark is low), the way the
 *                                        seventh generation's own tools pulled a normal map from a photograph; its colour
 *                                        keeps the light it was painted with, so this is an approximation and says so
 *                         null: a key no generator paints, or a cutout (a card keeps its paint)
 *   formRoomMaps(keys, { detail, budget }) → { textures: { key: base }, maps: { key: { normal, orm, read, depth, mean } },
 *     reliefSize? } (past `budget`, ROOM_MAPS, the dressed tiles' normal and ORM at `ROOM_MAPS.small`, their colour whole; a key no
 *                         material is read from: { read: 'paint', mean }, its paint kept)   `detail`: a toned
 *                         room's (era/tone.js), how far a twin's own light and dark move its colour
 *   readFormLight(lights, keys) → the page's lamp list: each lamp at its flame, its solved key (form/room-light.js), its
 *                         radius, and whether the page lights the relief by it (`live`: a pool is baked only)
 *
 * The page (scene/channels/form.js) multiplies each surface's colour by its baked light and lights its relief by the
 * lamps nearest the eye, by the bake's falloff (form/room-light.js). Pure: the dice are the tiles' own; memoized per key.
 */
import { dressedMaterial } from '../matte-paint/dressed.js';
import { reliefMaterial } from './relief-material.js';
import { surfaceTexture, generatedSpecOf, encodePng, SURFACE_TILING } from '../landscape/surface-textures.js';
import { decodePng } from '../era/tone.js';
import { paintMean } from './room-light.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const png = (rgb, W, H) => `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;

/** How rough each dressed cut is (the rest are stone's 0.85): wood a little less, glazed and machine faces less again,
 *  painted steel and a poured floor least (their sheen is what the near lamps find: scene/channels/form.js). */
export const FORM_ROUGH = Object.freeze({ boards: 0.72, brick: 0.82, precast: 0.7, stucco: 0.8, tile: 0.6, slate: 0.55, pavement: 0.88,
  plate: 0.5, tread: 0.42, block: 0.92, panel: 0.55, epoxy: 0.3, grating: 0.55, corrugated: 0.5,
  perforated: 0.5, terrazzo: 0.22, glazed: 0.18, studded: 0.75, seam: 0.45, acoustic: 0.95,
  matte: 0.9, carbon: 0.15, drywall: 0.85, carpet: 0.98, vinyl: 0.4, laminate: 0.45, porcelain: 0.35, veneer: 0.4 });
/** A painted tile read back as relief: metres of height a unit of luminance stands for, over a nominal metre a repeat. */
export const LUMINANCE_RELIEF = 0.006;

const cache = new Map();

export function formMaterialOf(key, { detail = 1, reliefSize = null } = {}) {
  if (typeof key !== 'string' || key.startsWith('card:') || key.includes(':card:')) return null;
  const ck = (detail === 1 ? key : `${key}|${detail}`) + (reliefSize ? `@${reliefSize}` : '');
  if (cache.has(ck)) return cache.get(ck);
  // a toned room's twin (era/tone.js `value:` / `shade:`): the tile's own material, its colour taken to grey (the room's
  // ramp colours it in the corners: era/stage.js formLightFaces)
  const twin = /^(value|shade):/.exec(key);
  if (twin) {
    const m = formMaterialOf(key.slice(twin[0].length)), d = m && decodePng(m.base), grey = d ? greyOf(d, detail) : null;
    const out = m && d ? { ...m, base: png(grey, d.W, d.H), mean: meanLinear(grey) } : null;
    cache.set(ck, out);
    return out;
  }
  const spec = generatedSpecOf(key);
  let out = null;
  if (spec && spec.gen === 'dressed') {
    const M = dressedMaterial(spec.cfg, { size: spec.size, seed: spec.seed, rough: FORM_ROUGH[spec.cfg.cut] ?? 0.85 });
    out = { ...relief(M, spec.cfg.metres ?? 2), read: 'relief' };
    // (a page over its maps' budget: the relief drawn smaller, the colour kept whole)
    if (reliefSize && reliefSize < spec.size) {
      const small = relief(dressedMaterial(spec.cfg, { size: reliefSize, seed: spec.seed, rough: FORM_ROUGH[spec.cfg.cut] ?? 0.85 }), spec.cfg.metres ?? 2);
      out = { ...out, normal: small.normal, orm: small.orm, reliefSize };
    }
  } else {
    const d = decodePng(surfaceTexture(key));
    if (d && !d.alpha) out = luminanceMaterial(d, SURFACE_TILING[key] === 'repeat', key);
  }
  cache.set(ck, out);
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
  return { ...relief(M, 1), read: 'luminance' };
}

/** Where a toned twin's greys are centred: on the toned page a tile only moves its colour along the ramp, where a material
 *  multiplies it (the page divides it by its mean, so the corner's base sets its colour: era/stage.js formLightFaces). */
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

/** How a tile's relief is marched on the page (channels/form.js): its height in the ORM's blue (1 the crest, 0 the deepest
 *  hollow, the island's convention: channels/form-land.js), and its DEPTH, that range in the tile's own units (a repeat
 *  is 1), the real relief's, held between PARALLAX.least and PARALLAX.most metres so a mortar joint reads and a pitched
 *  face does not swim. */
export const PARALLAX = Object.freeze({ least: 0.012, most: 0.05 });
function relief({ W, H, baseColor, normal, orm, height }, metres) {
  let lo = Infinity, hi = -Infinity;
  for (const h of height) { if (h < lo) lo = h; if (h > hi) hi = h; }
  const span = Math.max(1e-6, hi - lo), packed = Buffer.from(orm);
  for (let k = 0; k < W * H; k++) packed[k * 3 + 2] = Math.round(((height[k] - lo) / span) * 255);
  const depth = Math.min(PARALLAX.most, Math.max(PARALLAX.least, span));
  return { base: png(baseColor, W, H), normal: png(normal, W, H), orm: png(packed, W, H), depth: Math.round((depth / metres) * 1e5) / 1e5, mean: meanLinear(baseColor) };
}
// a colour's mean as the page reads it (sRGB bytes decoded to linear): what the solve's base stands for (form/room-light.js)
function meanLinear(rgb) {
  const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }, n = rgb.length / 3, m = [0, 0, 0];
  for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) m[c] += lin(rgb[k * 3 + c]);
  return m.map((v) => Math.round((v / n) * 1e4) / 1e4);
}

function blur(src, W, H, r, tile) {
  const ix = tile ? (i) => ((i % W) + W) % W : (i) => clamp(i, 0, W - 1), jx = tile ? (j) => ((j % H) + H) % H : (j) => clamp(j, 0, H - 1);
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0; for (let a = -r; a <= r; a++) s += src[j * W + ix(i + a)]; tmp[j * W + i] = s / n; }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0; for (let b = -r; b <= r; b++) s += tmp[jx(j + b) * W + i]; out[j * W + i] = s / n; }
  return out;
}

export function formRoomMaps(keys, { detail = 1, budget = ROOM_MAPS.budget } = {}) {
  const read = (reliefSize) => {
    const textures = {}, maps = {};
    let bytes = 0;
    for (const key of [...new Set(keys)].sort()) {
      const m = formMaterialOf(key, { detail: /^(value|shade):/.test(key) ? detail : 1, reliefSize });
      // (a tile no material is read from keeps its paint, its mean what the page divides it by: form/room-light.js)
      if (!m) { maps[key] = { read: 'paint', mean: paintMean(key) }; continue; }
      textures[key] = m.base; maps[key] = { normal: m.normal, orm: m.orm, read: m.read, depth: m.depth, mean: m.mean };
      bytes += m.base.length + (m.normal?.length ?? 0) + (m.orm?.length ?? 0);
    }
    return { textures, maps, bytes };
  };
  // a page whose maps would pass the budget (a building of many materials) draws its relief at the smaller size
  const whole = read(null);
  if (whole.bytes <= budget) return { textures: whole.textures, maps: whole.maps };
  const small = read(ROOM_MAPS.small);
  return { textures: small.textures, maps: small.maps, reliefSize: ROOM_MAPS.small };
}
/** The maps' budget on a page (data-URI bytes: a building of many materials passes it) and the relief's size past it. */
export const ROOM_MAPS = Object.freeze({ budget: 9e6, small: 256 });

const r4 = (v) => Math.round(v * 1e4) / 1e4;
/** The placed lights as the page lights them: `at` the flame, `key` its solved light (linear, form/room-light.js), its
 *  `radius`, and `live` (a lamp the page may light the relief by; a pool is light a bake lays where a window or an oculus
 *  would throw it: baked only); a lamp a beat changes carries its `beat` and `rate` (compose-plot.js BEATS): the page lights
 *  it whole, the bake holding none of it. */
export function readFormLight(lights, keys) {
  return lights.map((l, i) => ({ at: l.at.map(r4), key: keys[i].map(r4), radius: r4(l.radius), live: !QUIET.has(l.fixture), ...(l.beat ? { beat: l.beat, rate: l.rate } : {}) }));
}
// (lamps the bake holds alone: a pool, and a lamp inset in the floor, too weak to find a relief from the eye)
const QUIET = new Set(['pool', 'inset']);
