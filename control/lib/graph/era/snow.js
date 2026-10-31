/**
 * SNOW — a level's snow as a cover laid over its land, the cube's condition as its hour is (era/geocube.js `snow`, a
 * stage recipe's `snow`): where it lies is the land's (its height over the line, how steep, which way it faces, the
 * drift's patches), its colour the theorist's (solved from the world's own sky and sun), what grows under it the flora's.
 *
 *   SNOW_DEPTHS          { dusting, cover, deep } (m): a dusting the grass stands through, a cover it thins under, deep
 *                        snow it is gone under, the bushes mounds
 *   readSnow(spec)       → { line, depth, hold, drift, lee } or null; spec: true (a cover over the whole land), a depth's
 *                        word, or { line?, depth?, hold?, drift?, lee? }:
 *     line   metres over the land's lowest ground where the snow begins (absent: everywhere, a winter level); its edge
 *            wanders `EDGE` m either way, and the shade side holds it lower
 *     depth  a depth's word or metres (0.01 … 1)
 *     hold   how level the ground must be to hold it (the up of its normal, 0.5 … 0.98): steeper rock stands bare
 *     drift  0 … 1, how far the wind opens it in patches (0: unbroken)
 *     lee    0 … 1, how much longer the side away from the sun holds it, steeper and lower
 *   snowRamp(palette, light) → the snow's ramp, the length of the palette's rock: near-white, cool in its shade (the sky's
 *                        hue), warm in its light (the sun's); quiet in chroma, since the sky's light baked over it
 *                        already blues its shade
 *   snowAlbedo(ramp)     → what the land bakes it as: the ramp's stop below its lightest (snow is bright)
 *   snowFar(palette, snow) → the snow on the far ridges: the snow's light end hazed into each of the palette's far stops
 *   snowField(S, { base, sun, seed }) → (x, y, z, n) → > 0 where snow lies (n the ground's normal), the least of its terms
 *   grassUnder(S)        → the share of the grass that stands in the snow (1 at a dusting, 0 under deep snow)
 *   capOf(S)             → { up, share }: how far a leaf must turn up to carry snow, and the share of those that do
 *   snowMap(site, SF, S, ramp, cell?) → the snow as the form render reads it (scene/channels/form-land.js): { origin, cell,
 *                        size, px, depth, hold, drift, albedo, under } a map over the site, `cell` m a texel (0.5), RGBA
 *                        bytes base64, red how much snow lies there (the field's, read on the ground's own normal);
 *                        `albedo` the snow's colour (snowAlbedo), `under` the grass's share standing in it, `cap` a
 *                        leaf's (capOf)
 *   snowBase(albedo, light) → the snow's linear base under a cube's light (era/cube-light.js): the base that shows its
 *                        colour where the sun falls square, as the palette's own are solved, held under the most a base takes
 *
 * Pure: hashed noise only (era/dirt.js).
 */
import { vnoise } from './dirt.js';
import { oklch, lchOf, mixHue } from '../color-theorist/oklab.js';
import { hexRgb } from './geom.js';
import { displayToLinear, BASE_MAX } from '../color-theorist/light.js';

export const SNOW_DEPTHS = Object.freeze({ dusting: 0.03, cover: 0.15, deep: 0.45 });
export const SNOW_DEFAULTS = Object.freeze({ line: null, depth: SNOW_DEPTHS.cover, hold: 0.8, drift: 0.25, lee: 0.5 });
// the line's edge wandering (m) and its scale; the drift's patch scale (m); how sharp each term turns
const EDGE = 1.2, EDGE_SCALE = 7, DRIFT_SCALE = 5, SLOPE_SOFT = 0.06, DRIFT_SOFT = 0.12;

const no = (m) => { throw new Error(`snow: ${m}`); };
export function readSnow(spec) {
  if (spec === undefined || spec === null || spec === false) return null;
  if (spec === true) return { ...SNOW_DEFAULTS };
  if (typeof spec === 'string') { if (!(spec in SNOW_DEPTHS)) no(`'${spec}' is not a depth (${Object.keys(SNOW_DEPTHS).join(', ')}); or { line?, depth?, hold?, drift?, lee? }`); return { ...SNOW_DEFAULTS, depth: SNOW_DEPTHS[spec] }; }
  if (typeof spec !== 'object' || Array.isArray(spec)) no('snow is true, a depth (dusting, cover, deep) or { line?, depth?, hold?, drift?, lee? }');
  for (const k of Object.keys(spec)) if (!(k in SNOW_DEFAULTS)) no(`'${k}' is not one of snow's keys (line, depth, hold, drift, lee)`);
  const S = { ...SNOW_DEFAULTS, ...spec };
  if (typeof S.depth === 'string') { if (!(S.depth in SNOW_DEPTHS)) no(`depth '${S.depth}' is not one (${Object.keys(SNOW_DEPTHS).join(', ')}) or metres`); S.depth = SNOW_DEPTHS[S.depth]; }
  if (!(S.depth >= 0.01 && S.depth <= 1)) no('depth is metres, 0.01 to 1 (or dusting, cover, deep)');
  if (S.line !== null && !Number.isFinite(S.line)) no('line is metres over the land\'s lowest ground (absent: the whole land)');
  if (!(S.hold >= 0.5 && S.hold <= 0.98)) no('hold is how level the ground must be to hold snow, the up of its normal, 0.5 to 0.98');
  for (const k of ['drift', 'lee']) if (!(S[k] >= 0 && S[k] <= 1)) no(`${k} is 0 to 1`);
  return S;
}

export function snowRamp(palette, light) {
  const n = palette.rock?.length ?? 5, sky = palette.sky?.[0] ?? [150, 175, 210], key = light?.key?.color ? hexRgb(light.key.color).map((v) => v * 255) : [255, 244, 216];
  const [, , hS] = lchOf(sky), [, cK, hK] = lchOf(key);
  // (the light end warms toward the sun's hue only as far as the sun has one)
  return Array.from({ length: n }, (_, i) => { const t = n > 1 ? i / (n - 1) : 1; return oklch(0.6 + 0.37 * t, 0.014 - 0.006 * t, mixHue(hS, hK, cK > 0.02 ? t : 0)); });
}

export function snowFar(palette, snow) {
  const F = palette.far, top = snow[snow.length - 1];
  if (!F) return [];
  return F.map((c, i) => { const k = 0.3 + (F.length > 1 ? (0.35 * i) / (F.length - 1) : 0); return top.map((v, j) => Math.round(v + (c[j] - v) * k)); });
}

export function snowField(S, { base = 0, sun = [0, 0, 1], seed = 1 } = {}) {
  const sl = Math.hypot(sun[0], sun[1]) || 1, sx = sun[0] / sl, sy = sun[1] / sl;
  return (x, y, z, n = [0, 0, 1]) => {
    // (the side turned from the sun: + away, − toward, by how far the ground leans)
    const away = -(n[0] * sx + n[1] * sy), lee = S.lee * Math.max(0, away);
    const alt = S.line === null ? 1 : (z - base - S.line + lee * EDGE * 2 + EDGE * (2 * vnoise(x / EDGE_SCALE, y / EDGE_SCALE, seed + 1801) - 1)) / EDGE;
    const slope = (n[2] - S.hold + lee * 0.12) / SLOPE_SOFT;
    const patch = S.drift > 0 ? (vnoise(x / DRIFT_SCALE, y / DRIFT_SCALE, seed + 1811) - S.drift * 0.7) / DRIFT_SOFT : 1;
    return Math.min(alt, slope, patch);
  };
}

export const snowAlbedo = (R) => R[Math.max(0, R.length - 2)].map((v) => v / 255);
export const grassUnder = (S) => Math.max(0, Math.min(1, 1 - (S.depth - SNOW_DEPTHS.dusting) / (SNOW_DEPTHS.deep * 0.6)));
export const capOf = (S) => { const t = Math.max(0, Math.min(1, (S.depth - SNOW_DEPTHS.dusting) / (SNOW_DEPTHS.deep - SNOW_DEPTHS.dusting))); return { up: 0.72 - 0.4 * t, share: 0.55 + 0.4 * t }; };

export function snowMap(site, SF, S, ramp, cell = 0.5) {
  const g = site.grid, x0 = g.x0, y0 = g.y0, nx = Math.ceil(((g.nx - 1) * g.dx) / cell) + 1, ny = Math.ceil(((g.ny - 1) * g.dx) / cell) + 1;
  const px = new Uint8Array(nx * ny * 4), e = 0.25;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * cell, y = y0 + j * cell, z = site.ground(x, y);
    // (the ground's own normal there, across half a metre)
    const gx = (site.ground(x + e, y) - site.ground(x - e, y)) / (2 * e), gy = (site.ground(x, y + e) - site.ground(x, y - e)) / (2 * e), l = Math.hypot(gx, gy, 1);
    const v = SF(x, y, z, [-gx / l, -gy / l, 1 / l]), o = (j * nx + i) * 4;
    px[o] = Math.round(Math.max(0, Math.min(1, 0.5 + 0.5 * v)) * 255); px[o + 3] = 255;
  }
  const r4 = (v) => Math.round(v * 1e4) / 1e4, hex = (c) => '#' + c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  return { origin: [r4(x0), r4(y0)], cell, size: [nx, ny], px: Buffer.from(px).toString('base64'), depth: S.depth, hold: S.hold, drift: S.drift, albedo: hex(snowAlbedo(ramp)), under: r4(grassUnder(S)), cap: capOf(S) };
}

export function snowBase(albedo, light) {
  const T = displayToLinear(albedo), A = light.ambient.linear, S = light.sun.linear;
  return T.map((v, k) => Math.round(Math.min(BASE_MAX, v / Math.max(1e-6, A[k] + S[k])) * 1e4) / 1e4);
}
