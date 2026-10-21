/**
 * DETAIL — a dressed tile laid on a face as relief over its own paint: the painted tile (dressed.js) divided by its own
 * mean, per channel in linear light, and set to `DETAIL_MEAN`; the face's colour (its baked light in it) lifted by the
 * inverse, so the page's multiply (`textureLit`: texel × vertex colour) gives back the face's paint and light with the
 * stone's relief, patches and joints riding on them. Laid world-locked: a metre is a metre on every face (a wall's u
 * along it and v up it, a roof's v up its slope, a floor's u and v its own x and y), so a wall cut into a hundred
 * facets (a facade's piers and spandrels) carries one continuous stone.
 *
 *   detailKey(params, seed, metres, v)    the tile's key (`detail:dressed-<hash>-a|b`), registered for the resolver:
 *                                         `params` the dressed tile's (on its rails), painted at `metres` a repeat
 *   layDetail(face, { key, metres, unit, as })   the face dressed (`as`: 'wall' | 'roof' | 'floor'; `unit` the world's
 *                                         metres a unit), or the face itself when it is not that kind of face
 *   DETAIL_MEAN                           the mean a detail is set to (linear)
 *
 * The tiles are served by a texture resolver (`detail:`), painted once a key. Pure.
 */
import { dressedTile } from './dressed.js';
import { encodePng, registerTextureResolver } from '../landscape/surface-textures.js';

export const DETAIL_MEAN = 0.8;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const srgb = (c) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// the tiles, by key: what each is painted from (filled as keys are made, read by the resolver)
const SPECS = new Map(), PAINTED = new Map();
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(36); }
export function detailKey(params, seed, metres, v) {
  const key = `detail:dressed-${hash(JSON.stringify([params, seed, metres]))}-${'ab'[v]}`;
  if (!SPECS.has(key)) SPECS.set(key, { cfg: { ...params, metres }, seed: seed * 1009 + 7 + v * 13 });
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
// a face's unit normal: its own, else by Newell's sum
function normalOf(f) {
  if (Array.isArray(f.normal) && f.normal.length === 3) return f.normal;
  let x = 0, y = 0, z = 0;
  const c = f.corners;
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** A face dressed with a detail tile, world-locked: a wall (no steeper than 45° off upright), a pitched roof (u along
 *  its eave, v up its slope: a rise over the pitch's sine), or a floor (level, whichever way its corners wind). Any other face is returned as it is. */
export function layDetail(face, { key, metres, unit = 1, as = 'wall' }) {
  if (!face.corners || face.corners.length < 3 || typeof face.fill !== 'string') return face;
  const n = normalOf(face), h = Math.hypot(n[0], n[1]);
  if (as === 'wall' ? Math.abs(n[2]) > 0.7 : as === 'roof' ? h < 0.12 || n[2] <= 0 : Math.abs(n[2]) < 0.7) return face;
  const t = h > 1e-9 ? [-n[1] / h, n[0] / h] : [1, 0], up = as === 'roof' ? 1 / h : 1, m = (v) => r4((v * unit) / metres);
  const uv = face.corners.map((p) => (as === 'floor' ? [m(p[0]), m(p[1])] : [m(p[0] * t[0] + p[1] * t[1]), m(p[2] * up)]));
  return { ...face, texture: key, textureLit: true, uv, fill: lift(face.fill), ...(face.cornerFills ? { cornerFills: face.cornerFills.map(lift) } : {}) };
}
