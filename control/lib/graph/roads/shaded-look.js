/**
 * THE SHADED LOOK — the sixth generation's (GameCube, PS2: Super Mario Sunshine, Kingdom Hearts; era/sixth-gen.js
 * holds its research cards): the world's light baked into the corners of its polygons and spread across them
 * (Gouraud), not cut into pixels or cubes. What makes the read:
 *
 *   smooth     a corner's normal the average of the faces that meet there (within a crease angle), so a drum, a cone,
 *              a dome reads round and a box keeps its edges
 *   the sky    a hemisphere of fill: sky blue from above, a warm bounce from below
 *   hard sun   a high warm key with real cast shadows (era/sun.js), the shade a clean pale blue, never black (Sunshine's
 *              first principle: era/style/delfino-plaza.js)
 *   colour     saturated, the colour the painted stop's; no tiles
 *
 *   shadeFaces(faces, { colourOf, light, crease, shadows }) → faces lit per corner (cornerFills), four corners at most
 *   SHADED_LIGHT → Sunshine's island noon (era/sixth-gen.js `sunshine`)
 *
 * Pure, deterministic.
 */
import { makeSunShadow, sunDir } from '../era/sun.js';
import { SIXTH_GEN_REFERENCES } from '../era/sixth-gen.js';

const S = SIXTH_GEN_REFERENCES.sunshine.light;
export const SHADED_LIGHT = Object.freeze({ key: S.key, sky: S.ambient, ground: '#f0d8a8', fill: 0.55, sunGain: 0.85, shadeFloor: 0.62, saturate: 1.18, crease: 50 });
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
function newell(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  return unit(n);
}
const saturate = (c, k) => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return c.map((v) => l + (v - l) * k); };

/** Faces lit the sixth generation's way: each corner its smoothed normal under the sky, the bounce and the sun. */
export function shadeFaces(faces, { colourOf, light = SHADED_LIGHT, shadows = true } = {}) {
  const L = sunDir(light.key.elevation, light.key.azimuth), key = hexRgb(light.key.color), sky = hexRgb(light.sky), grd = hexRgb(light.ground);
  const cosC = Math.cos(((light.crease ?? 50) * Math.PI) / 180);
  // the faces wound to their own normals; the corners that meet, by position
  const F = faces.filter((f) => f.corners?.length >= 3).map((f) => { const wn = newell(f.corners), n = f.normal ? unit(f.normal) : wn, flip = wn[0] * n[0] + wn[1] * n[1] + wn[2] * n[2] < 0; return { f, c: flip ? f.corners.slice().reverse() : f.corners, n }; });
  const at = new Map(), k = (p) => p.map((v) => Math.round(v * 200)).join(',');
  for (const x of F) for (const p of x.c) { const kk = k(p); if (!at.has(kk)) at.set(kk, []); at.get(kk).push(x.n); }
  const smooth = (p, n) => unit((at.get(k(p)) ?? [n]).filter((m) => m[0] * n[0] + m[1] * n[1] + m[2] * n[2] >= cosC).reduce((s, m) => [s[0] + m[0], s[1] + m[1], s[2] + m[2]], [0, 0, 0]));
  const sunAt = shadows ? makeSunShadow(F.map((x) => ({ corners: x.c })), L, { cell: 1 }) : () => 1;
  const out = [];
  for (const x of F) {
    const base = saturate(colourOf(x.f), light.saturate), ctr = x.c.reduce((s, p) => [s[0] + p[0] / x.c.length, s[1] + p[1] / x.c.length, s[2] + p[2] / x.c.length], [0, 0, 0]);
    const lam0 = Math.max(0, x.n[0] * L[0] + x.n[1] * L[1] + x.n[2] * L[2]), sunlit = lam0 > 0 ? sunAt([ctr[0] + x.n[0] * 0.03, ctr[1] + x.n[1] * 0.03, ctr[2] + x.n[2] * 0.03], x.n) : 0;
    const lit = (p) => {
      const n = smooth(p, x.n), up = (n[2] + 1) / 2, lam = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) * sunlit;
      // the sky from above and the bounce from below, a pale blue floor under the shade; the sun's warm key over it
      const fill = sky.map((s, i) => (s * up + grd[i] * (1 - up)) * light.fill);
      return base.map((v, i) => v * Math.max(light.shadeFloor * sky[i] * 0.9 + 0.1, fill[i] + key[i] * light.sunGain * lam));
    };
    const cs = x.c.map(lit), n = x.c.length;
    // four corners at most (the World draws a face's first four): a fan of quads
    const idx = n <= 4 ? [[...Array(n).keys()]] : Array.from({ length: Math.ceil((n - 2) / 2) }, (_, j) => { const i = 1 + 2 * j; return i + 2 < n ? [0, i, i + 1, i + 2] : [0, i, i + 1]; });
    for (const I of idx) out.push({ corners: I.map((i) => x.c[i]), fill: toHex(I.reduce((s, i) => s.map((v, q) => v + cs[i][q] / I.length), [0, 0, 0])), cornerFills: I.map((i) => toHex(cs[i])) });
  }
  return out;
}
