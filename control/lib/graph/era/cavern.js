/**
 * THE CAVERN — a whole trail underground: its land the geocube's (out-trail.js), closed in by its cliffs, under a
 * pretend ceiling of the same rock, its floor soil and scree, its water a trail's, its formations its own, lit only by
 * what it lets in and what it lights. A level could be set in one whole (a platformer in a cave).
 *
 *   trail.ground.cavern: true | { height?, skylight?, formations?, light? }
 *     height      metres the ceiling's crown stands over its rim (CAVERN.height)
 *     skylight    { y, r? }: a hole in the ceiling over the walk at station y, `r` metres across (CAVERN.skylight): a
 *                 shaft of day, the only daylight it has
 *     formations  0…1, how thick its stalagmites and stalactites stand (CAVERN.formations)
 *     light       its register past the day (era/cave.js CAVE_LIGHTS): 'torch' (the default), 'fluorescent', 'bio', or
 *                 'daylight' (none: its dark and its skylight alone)
 *
 *   readCavern(v, at)                       the recipe checked → { height, skylight, formations, light }
 *   encloseCavern(g, C, ctx) → { top }      the grid's open side and ends raised to the far cliff's top, the walk's
 *                                           notch through each end kept (the way on); `top` that height
 *   cavernDome(site, C) → (x, y) → z        the ceiling: a dome over the site, its rim the cliffs' top, lumped
 *   domeFaces(site, C, seed) → faces        its underside, down-facing, cut where the skylight is
 *   formations(site, C, seed) → items       stalagmites off the walk and the water, stalactites over them and on their
 *                                           own, columns where a pair nearly meets: [{ x, y, z0, z1, r, kind, v }]
 *   formationFaces(it, seed) → faces        a formation as lofted rings, the land's rock
 *   cavernLamps(site, C) → lamps            the register's lamps along the walk (torches both sides, tubes on posts,
 *                                           growth at the walls' feet and by the water)
 *   cavernLight(faces, site, C, { open })   each face lit by its dark, the skylight it sees and the lamps it sees
 *
 * Pure: the same recipe makes the same cavern.
 */
import { formFactor, lampLight, CAVE_LIGHT_IDS } from './cave.js';

export const CAVERN = Object.freeze({ height: 18, skylight: 6, formations: 0.5, light: 'torch', gap: 6, face: 3, endRun: 6, cell: 2, lump: 1.4, dark: 0.04 });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const r5 = (v) => Math.round(v * 1e5) / 1e5;
// a hash in 0…1 of integers (the land's dice are its own; the cavern's are these)
const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const vnoise = (x, y, s) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), h = (i, j) => hash(xi + i, yi + j, s);
  return (h(0, 0) * (1 - u) + h(1, 0) * u) * (1 - v) + (h(0, 1) * (1 - u) + h(1, 1) * u) * v; };

export function readCavern(v, at = 'trail.ground.cavern') {
  if (v === undefined || v === false) return null;
  if (v === true) v = {};
  if (!isObj(v)) throw new Error(`stage: ${at} is true or { height?, skylight?, formations?, light? }`);
  for (const k of Object.keys(v)) if (!['height', 'skylight', 'formations', 'light'].includes(k)) throw new Error(`stage: ${at}.${k} is not a cavern setting (height, skylight, formations, light)`);
  const num = (o, k, lo, hi, d, w, words) => { if (o[k] === undefined) return d; if (typeof o[k] !== 'number' || !(o[k] >= lo && o[k] <= hi)) throw new Error(`stage: ${w}.${k} is ${words}`); return o[k]; };
  let skylight = null;
  if (v.skylight !== undefined && v.skylight !== false) {
    if (!isObj(v.skylight)) throw new Error(`stage: ${at}.skylight is { y, r? }: a hole in its ceiling over the walk`);
    for (const k of Object.keys(v.skylight)) if (!['y', 'r'].includes(k)) throw new Error(`stage: ${at}.skylight.${k} is not a skylight setting (y, r)`);
    skylight = { y: num(v.skylight, 'y', 0, 400, null, `${at}.skylight`, 'the station it opens over, metres along the trail'), r: num(v.skylight, 'r', 1, 30, CAVERN.skylight, `${at}.skylight`, 'metres across, 1 to 30') };
    if (skylight.y === null) throw new Error(`stage: ${at}.skylight needs y, the station it opens over`);
  }
  const light = v.light ?? CAVERN.light;
  if (!CAVE_LIGHT_IDS.includes(light)) throw new Error(`stage: ${at}.light is one of ${CAVE_LIGHT_IDS.join(', ')}`);
  return { height: num(v, 'height', 4, 60, CAVERN.height, at, 'metres the crown stands over its rim, 4 to 60'), skylight, formations: num(v, 'formations', 0, 1, CAVERN.formations, at, 'how thick its formations stand, 0 to 1'), light };
}

export function encloseCavern(g, C, { gridX, gridY, walkLevel, trailX, edge, D, cliffX }) {
  // the far cliff's top: the highest land behind its line
  let top = -Infinity;
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) if (gridX(g, i) < cliffX(gridY(g, j)) - 3) top = Math.max(top, g.z[j * g.nx + i]);
  if (!Number.isFinite(top)) top = Math.max(...g.z);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = gridX(g, i), y = gridY(g, j), q = j * g.nx + i, ex = trailX(y) + edge(y) + CAVERN.gap;
    // (the open side a wall past the walk's edge; each end a wall but for the walk's own notch through it)
    const side = smooth(ex, ex + CAVERN.face, x), end = Math.max(1 - smooth(0, CAVERN.endRun, y), smooth(D - CAVERN.endRun, D, y)) * (1 - walkLevel(x, y));
    const w = Math.max(side, end); if (w <= 0) continue;
    const t = top - 1.2 + 2.4 * vnoise(x * 0.15, y * 0.15, 97);
    if (t > g.z[q]) { g.z[q] += (t - g.z[q]) * w; if (g.apron) g.apron[q] *= 1 - w; }
  }
  return { top };
}

export function cavernDome(site, C) {
  const g = site.grid, x0 = g.x0, x1 = site.W, y0 = 0, y1 = site.D, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2, top = site.cavern.top;
  return (x, y) => {
    const u = (x - cx) / rx, v = (y - cy) / ry, e = Math.sqrt(Math.max(0, 1 - u * u - v * v));
    return top + 1 + C.height * Math.pow(e, 0.7) + CAVERN.lump * (vnoise(x * 0.12, y * 0.12, 131) - 0.5) * 2;
  };
}

export function domeFaces(site, C) {
  const g = site.grid, z = cavernDome(site, C), s = CAVERN.cell, out = [], sk = C.skylight;
  const hole = sk ? [site.trailX(sk.y), sk.y] : null, inHole = (x, y) => hole && Math.hypot(x - hole[0], y - hole[1]) < sk.r / 2;
  for (let y = 0; y < site.D - 1e-6; y += s) for (let x = g.x0; x < site.W - 1e-6; x += s) {
    const cs = [[x, y], [x, y + s], [x + s, y + s], [x + s, y]];
    if (cs.every(([a, b]) => inHole(a, b))) continue;
    // (a cell the skylight's edge crosses: its corners in the hole drawn up to its rim, so the hole reads round enough)
    out.push({ corners: cs.map(([a, b]) => [r5(a), r5(b), r5(z(a, b) + (inHole(a, b) ? 2.5 : 0))]), under: true });
  }
  return out;
}

export function formations(site, C, seed = 1) {
  const out = [], z = cavernDome(site, C), g = site.grid, n = Math.round(C.formations * site.D * (site.W - g.x0) / 40);
  for (let k = 0; k < n; k++) {
    const x = g.x0 + 2 + hash(k, 1, seed + 401) * (site.W - g.x0 - 4), y = 2 + hash(k, 2, seed + 403) * (site.D - 4);
    // (off the walk and out of the water; a skylight's shaft kept clear)
    if (site.trailDist(x, y) < site.halfWAt(y) + 2.5) continue;
    if ((site.wet && site.wet(x, y)) || (site.water && site.water.clear(x, y))) continue;
    if (C.skylight && Math.hypot(x - site.trailX(C.skylight.y), y - C.skylight.y) < C.skylight.r) continue;
    const z0 = site.ground(x, y), z1 = z(x, y), gap = z1 - z0;
    if (!(gap > 3)) continue;
    const roll = hash(k, 3, seed + 409), r = 0.25 + 0.9 * hash(k, 4, seed + 411), h = Math.min(gap * 0.45, (1.2 + 4.5 * hash(k, 5, seed + 413)) * (0.5 + r));
    if (roll < 0.12) out.push({ x: r5(x), y: r5(y), z0: r5(z0 - 0.2), z1: r5(z1 + 0.5), r: r5(r * 1.6), kind: 'column', v: k });
    else {
      if (roll < 0.75) out.push({ x: r5(x), y: r5(y), z0: r5(z0 - 0.2), z1: r5(z0 + h), r: r5(r), kind: 'mite', v: k });
      if (roll > 0.45) { const ht = Math.min(gap * 0.35, h * (0.6 + 0.6 * hash(k, 6, seed + 419))); out.push({ x: r5(x), y: r5(y), z0: r5(z1 + 0.5), z1: r5(z1 - ht), r: r5(r * 0.8), kind: 'tite', v: k }); }
    }
  }
  return out;
}

/** A formation as lofted rings: a stalagmite up from its foot, a stalactite down from its root, a column waisted
 *  between floor and ceiling. → faces of the land's rock (`cel: 'rock'`, `isekai:rock`). */
export function formationFaces(it, seed = 1, scale = 1.5) {
  const sides = 6 + Math.floor(hash(it.v, 7, seed + 421) * 3), k = it.v * 13 + 7, out = [];
  const prof = it.kind === 'column' ? [[0, 1.1], [0.2, 0.85], [0.5, 0.55], [0.8, 0.8], [1, 1.15]] : [[0, 1], [0.35, 0.7], [0.7, 0.35], [0.92, 0.12], [1, 0.02]];
  const rings = prof.map(([t, sh], ri) => Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * (i + 0.3 * hash(k, i, seed + 431 + ri))) / sides, w = it.r * sh * (0.85 + 0.3 * hash(k, i + 17 * ri, seed + 433));
    const lean = 0.15 * it.r * t * (hash(k, 1, seed + 437) - 0.5);
    return [r5(it.x + Math.cos(a) * w + lean), r5(it.y + Math.sin(a) * w + lean), r5(it.z0 + (it.z1 - it.z0) * t)];
  }));
  const up = it.z1 > it.z0;
  for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < sides; i++) {
    const i1 = (i + 1) % sides, a = rings[r][i], b = rings[r][i1], c = rings[r + 1][i1], d = rings[r + 1][i];
    const cs = up ? [a, b, c, d] : [d, c, b, a], mx = (a[0] + b[0]) / 2 - it.x, my = (a[1] + b[1]) / 2 - it.y, l = Math.hypot(mx, my) || 1;
    out.push({ corners: cs, normal: [r5(mx / l), r5(my / l), 0], outNormal: [r5(mx / l), r5(my / l), 0], cel: 'rock', group: 'isekai:rock',
      uv: cs.map((p, q) => [r5((((i + (q === 1 || q === 2 ? 1 : 0)) * 2 * Math.PI * it.r) / sides) / scale), r5(p[2] / scale)]) });
  }
  return out;
}

/** The cavern as a cave to its lamps (era/cave.js lampLight, lampFaces): one wide room, no floor in the way, its
 *  ceiling the dome; its lamps the register's along the walk. */
export function cavernAsCave(site, C) {
  if (site.cavern._asCave) return site.cavern._asCave;
  const z = cavernDome(site, C), cave = { light: C.light, width: 12, inside: () => ({ d: 0, s: 0 }), ceil: z, floor: () => -1e9, covered: () => true, heightAt: () => C.height };
  cave._lamps = cavernLamps(site, C);
  site.cavern._asCave = cave;
  return cave;
}

export function cavernLamps(site, C) {
  const out = [];
  if (C.light === 'daylight') return out;
  const step = C.light === 'bio' ? 4 : C.light === 'fluorescent' ? 9 : 7;
  let k = 0;
  for (let y = 4; y < site.D - 2; y += step, k++) {
    const x = site.trailX(y), dx = site.trailX(y + 0.5) - site.trailX(y - 0.5), l = Math.hypot(dx, 1), dir = [dx / l, 1 / l], n = [dir[1], -dir[0]], e = site.halfWAt(y) + 1.2;
    if (C.light === 'torch') for (const sg of [-1, 1]) { const p = [x + n[0] * sg * e, y + n[1] * sg * e]; out.push({ at: [r5(p[0]), r5(p[1]), r5(site.ground(...p) + 2.2)], kind: 'torch', dir, side: -sg }); }
    if (C.light === 'fluorescent') { const p = [x + n[0] * e, y + n[1] * e]; out.push({ at: [r5(p[0]), r5(p[1]), r5(site.ground(...p) + 4.5)], kind: 'fluorescent', dir }); }
    if (C.light === 'bio') { const sg = k % 2 ? 1 : -1, p = [x + n[0] * sg * (e + 2.5 + 3 * hash(k, 1, 503)), y + n[1] * sg * (e + 2.5 + 3 * hash(k, 1, 503))]; const g0 = site.ground(...p); out.push({ at: [r5(p[0]), r5(p[1]), r5(g0 + 0.6)], kind: 'bio', dir, foot: r5(g0) }); }
  }
  return out;
}

/** What a point in the cavern sees of the day: the skylight, against an open face of its tilt; never less than its dark. */
function cavernSky(site, C, p, n) {
  const sk = C.skylight;
  if (!sk) return CAVERN.dark;
  const z = cavernDome(site, C), c = [site.trailX(sk.y), sk.y], poly = Array.from({ length: 12 }, (_, i) => { const a = (2 * Math.PI * i) / 12, x = c[0] + Math.cos(a) * sk.r / 2, y = c[1] + Math.sin(a) * sk.r / 2; return [x, y, z(x, y) + 2.5]; });
  const open = Math.max(0.05, (1 + n[2]) / 2);
  return Math.min(1, CAVERN.dark + formFactor(p, n, poly) / open);
}

/** Every face of the cavern lit by its dark, the skylight it sees and its lamps (their own faces as they are); a sunlit
 *  corner keeps its sun (the shaft through the skylight). As caveLight, against the hour's bake (`open`). */
export function cavernLight(faces, site, C, { open = 1 } = {}) {
  const cave = cavernAsCave(site, C), gain = 1 / Math.max(0.12, open);
  const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`, rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return faces.map((f) => {
    if (!f.fill || !f.corners || f.lamp || f.self) return f;
    const n = f.normal ?? [0, 0, 1], shares = Array.isArray(f.sunShare) ? f.sunShare : f.corners.map(() => f.sunShare ?? 0);
    const ks = f.corners.map((c, i) => {
      const sh = shares[i] ?? 0, q = [c[0] + n[0] * 0.1, c[1] + n[1] * 0.1, c[2] + n[2] * 0.1], k = cavernSky(site, C, q, n), lm = lampLight(cave, q, n);
      const all = sh + (1 - sh) * k, rgbK = lm.map((v) => all + v * gain), lum = 0.3 * rgbK[0] + 0.59 * rgbK[1] + 0.11 * rgbK[2];
      return { rgbK, share: sh > 0 ? sh / Math.max(1e-6, lum) : 0 };
    });
    const fills = (f.cornerFills ?? f.corners.map(() => f.fill)).map((c, i) => hex(rgb(c).map((v, ch) => v * ks[i].rgbK[ch])));
    const mean = [0, 1, 2].map((ch) => ks.reduce((a, q) => a + q.rgbK[ch], 0) / ks.length);
    return { ...f, fill: hex(rgb(f.fill).map((v, ch) => v * mean[ch])), cornerFills: fills, ...(f.sunShare !== undefined ? { sunShare: Array.isArray(f.sunShare) ? ks.map((q) => Math.round(q.share * 1e3) / 1e3) : Math.round((ks.reduce((a, q) => a + q.share, 0) / ks.length) * 1e3) / 1e3 } : {}) };
  });
}
