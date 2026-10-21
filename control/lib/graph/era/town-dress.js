/**
 * TOWN DRESS — a gritty cube's street painted from relief, as its island's rock is: the walls' plaster a lime render
 * fallen away here and there to the coursed stone under it (the Dust map), the stone walls ashlar, the plinths a course of
 * long blocks (matte-paint/dressed.js). Each is laid on a placed face as a DETAIL: the painted tile divided by its own
 * mean (per channel, in linear light) and set to `DETAIL_MEAN`, the face's own colour and baked light lifted by its
 * inverse, so the face keeps its paint (the cube's ramps, era/out-structures-paint.js) and its light, and the stone's
 * relief, its patches and its joints ride on them. Laid world-locked (a metre is a metre on every wall: u along the
 * wall, v up it), the two variants by where the wall stands.
 *
 *   townDressOf(cube)                        → the street's dress (a cube's grit ≥ GRIT_PIXELS), or null
 *   dressTownFace(face, group, dress)        → the face dressed for its source group ('str:plaster', 'str:stone',
 *                                              'plinth'), or the face itself (no dress for it, or not a wall)
 *   DETAIL_MEAN                              the mean a detail is set to (linear)
 *
 * The detail tiles are served by a texture resolver (`detail:`), painted once a spec. Pure: the cube's numbers and the
 * walls' places only. Absent a dress, a town is as it was, byte for byte.
 */
import { dressedTile } from '../matte-paint/dressed.js';
import { encodePng, registerTextureResolver } from '../landscape/surface-textures.js';
import { normalizeTileSpec } from './tile-specs.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';

export const DETAIL_MEAN = 0.8;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const srgb = (c) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** A gritty cube's street dress: each source group's dressed stone, in the cube's own colours, tuned by its grit. */
export function townDressOf(cube) {
  const g = cube.grit;
  if (g === undefined || g < GRIT_PIXELS) return null;
  const stone = rgbOf(cube.colour.stone), mortar = stone.map((v) => Math.round(v * 0.68)), coat = rgbOf(cube.colour.floor).map((v) => Math.min(255, Math.round(v * 1.05 + 10)));
  const wear = { grit: g, spall: Math.min(1, g), pit: Math.round(60 * g) / 100 };
  return {
    // (a render's repeat is long: its patches are a wall's few, not a tile's one)
    'str:plaster': { spec: { gen: 'dressed', cut: 'render', stone, mortar, render: coat, rows: 6, cols: 2, ...wear, loss: Math.round(Math.min(1, 0.1 + 0.6 * g) * 100) / 100, seed: 23 }, metres: 3 },
    'str:stone': { spec: { gen: 'dressed', stone, mortar, rows: 5, cols: 2, tool: g >= 0.85 ? 'pitched' : 'tooled', ...wear, seed: 29 }, metres: 2.4 },
    plinth: { spec: { gen: 'dressed', stone: stone.map((v) => Math.round(v * 0.9)), mortar, rows: 2, cols: 2, tool: 'pitched', ...wear, seed: 31 }, metres: 1.6 },
  };
}

// the detail tiles, by key: what each is painted from (filled as faces are dressed, read by the resolver)
const SPECS = new Map(), PAINTED = new Map();
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(36); }
function detailKey(entry, v) {
  // (the spec on the dressed tile's rails, in their order: anything off them refused)
  const { seed = 1, ...params } = normalizeTileSpec(entry.spec, 'town dress').params;
  const key = `detail:dressed-${hash(JSON.stringify([params, seed, entry.metres]))}-${'ab'[v]}`;
  if (!SPECS.has(key)) SPECS.set(key, { cfg: { ...params, metres: entry.metres }, seed: seed * 1009 + 7 + v * 13 });
  return key;
}
registerTextureResolver('detail:', (key) => {
  if (PAINTED.has(key)) return PAINTED.get(key);
  const S = SPECS.get(key);
  if (!S) return null;
  const T = dressedTile(S.cfg, { size: 512, seed: S.seed }), n = T.W * T.H, m = [0, 0, 0], L = new Float32Array(n * 3);
  for (let k = 0; k < n * 3; k++) { L[k] = lin(T.rgb[k]); m[k % 3] += L[k]; }
  for (let c = 0; c < 3; c++) m[c] = m[c] / n || 1;
  const out = Buffer.alloc(n * 3);
  for (let k = 0; k < n * 3; k++) out[k] = Math.round(srgb(Math.min(1, (L[k] / m[k % 3]) * DETAIL_MEAN)));
  const url = `data:image/png;base64,${encodePng(out, T.W, T.H).toString('base64')}`;
  if (PAINTED.size >= 24) PAINTED.clear();
  PAINTED.set(key, url);
  return url;
});

const lift = (hex) => hexOf(rgbOf(hex).map((v) => srgb(Math.min(1, lin(v) / DETAIL_MEAN))));
/** A placed face dressed for its source group: a wall (no steeper than 45° off upright) of a group the dress names. */
export function dressTownFace(face, group, dress) {
  const E = dress && dress[group], n = face.normal;
  if (!E || !n || Math.abs(n[2]) > 0.7 || !face.corners || face.corners.length < 3) return face;
  const h = Math.hypot(n[0], n[1]) || 1, t = [-n[1] / h, n[0] / h];
  const c0 = face.corners[0], v = Math.floor(Math.abs(c0[0] * 0.37 + c0[1] * 0.61 + c0[2] * 0.13)) % 2;
  const uv = face.corners.map((p) => [r4((p[0] * t[0] + p[1] * t[1]) / E.metres), r4(p[2] / E.metres)]);
  return { ...face, texture: detailKey(E, v), textureLit: true, uv, fill: lift(face.fill), cornerFills: (face.cornerFills ?? [face.fill]).map(lift) };
}
