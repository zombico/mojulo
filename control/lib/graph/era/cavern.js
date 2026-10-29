/**
 * THE CAVERN — a whole trail underground: its land the geocube's (out-trail.js), closed in by its cliffs, under a
 * pretend ceiling of the same rock, its floor soil and scree, its water a trail's, its formations its own, lit only by
 * what it lets in and what it lights. A level could be set in one whole (a platformer in a cave).
 *
 *   trail.ground.cavern: true | { height?, skylight?, formations?, light?, ends?, cracks? }
 *     height      metres the ceiling's crown stands over its rim (CAVERN.height)
 *     skylight    { y, r? }: a hole in the ceiling over the walk at station y, `r` metres across (CAVERN.skylight): a
 *                 shaft of day, the only daylight it has
 *     formations  0…1, how thick its stalagmites and stalactites stand (CAVERN.formations)
 *     light       its register past the day (era/cave.js CAVE_LIGHTS): 'torch' (the default), 'fluorescent', 'bio', or
 *                 'daylight' (none: its dark and its skylight alone)
 *     cracks      0…1, how many CRACKS in its ceiling let a thread of day in (CAVERN.cracks): each a jagged slit over the
 *                 walk drawn bright on the rock, laying a cool daylight on what it can see; a cavern lit by its cracks
 *                 needs no torch (its register 'daylight')
 *     ends        'closed' (the default: the walk ends at the rock both ways) or 'open' (a passage out under a lintel where
 *                 the walk runs out of each end, the day beyond it)
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
import { tileFamilyOf } from './tile-specs.js';

export const CAVERN = Object.freeze({ cracks: 0.5, height: 18, skylight: 10, formations: 0.5, light: 'torch', gap: 6, face: 3, endRun: 6, cell: 2, lump: 1.4, dark: 0.04 });
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
  for (const k of Object.keys(v)) if (!['height', 'skylight', 'formations', 'light', 'ends', 'cracks'].includes(k)) throw new Error(`stage: ${at}.${k} is not a cavern setting (height, skylight, formations, light, ends, cracks)`);
  if (v.ends !== undefined && !['closed', 'open'].includes(v.ends)) throw new Error(`stage: ${at}.ends is 'closed' (the walk ends at the rock) or 'open' (a passage out at each end)`);
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
  return { height: num(v, 'height', 4, 60, CAVERN.height, at, 'metres the crown stands over its rim, 4 to 60'), skylight, formations: num(v, 'formations', 0, 1, CAVERN.formations, at, 'how thick its formations stand, 0 to 1'), light, ends: v.ends ?? 'closed', cracks: num(v, 'cracks', 0, 1, CAVERN.cracks, at, 'how many cracks let the day in, 0 to 1') };
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
    // (its rim over the walls' tops, lumps and all: the walls stand at their top ± 1.2)
    return top + 3 + C.height * Math.pow(e, 0.7) + CAVERN.lump * (vnoise(x * 0.12, y * 0.12, 131) - 0.5) * 2;
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
  // its SKIRT: round its edge a curtain of the rock from the ceiling down into the land, so no sky shows past its rim; with
  // its ends open, where the walk runs out of an end down only to a lintel over it, the way on a passage
  const lintel = (x, y) => (C.ends === 'open' && site.trailDist(x, y) < site.halfWAt(y) + 2 ? site.ground(x, y) + 3.5 : site.ground(x, y) - 1);
  const edge = (a, b) => { const z0a = lintel(...a), z0b = lintel(...b); out.push({ corners: [[a[0], a[1], z0a], [b[0], b[1], z0b], [b[0], b[1], z(...b)], [a[0], a[1], z(...a)]].map((p) => p.map(r5)), under: false, skirt: true }); };
  for (let x = g.x0; x < site.W - 1e-6; x += s) { edge([x, 0], [x + s, 0]); edge([x + s, site.D], [x, site.D]); }
  for (let y = 0; y < site.D - 1e-6; y += s) { edge([g.x0, y + s], [g.x0, y]); edge([site.W, y], [site.W, y + s]); }
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
  cave._lamps = [...cavernLamps(site, C), ...cavernCracks(site, C).flatMap((c) => c.lamps)];
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

// the share of what reaches its floor the cavern's rock gives back to it all (one closed room: its bounce)
const RHO = 0.5;
/**
 * The cavern's own BOUNCE: in one closed hall what its lamps and its skylight lay on its floor is given back by every
 * wall, so the whole room stands at the rock's share of the mean of it: read at points along its walk and to either side
 * of it, per channel, in the day's units (the skylight's) and the lamps' (to be raised against the hour). Memoised.
 */
function bounceOf(site, C, cave) {
  if (site.cavern._bounce) return site.cavern._bounce;
  const sky = [0, 0, 0], lamp = [0, 0, 0];
  let n = 0;
  for (let y = 2; y < site.D - 2; y += 3) for (const off of [-8, -3, 0, 3, 8]) {
    const x = site.trailX(y) + off, p = [x, y, site.ground(x, y) + 0.2], k = cavernSky(site, C, p, [0, 0, 1]) - CAVERN.dark, lm = lampLight(cave, p, [0, 0, 1]);
    for (let c = 0; c < 3; c++) { sky[c] += k; lamp[c] += lm[c]; }
    n++;
  }
  site.cavern._bounce = { sky: sky.map((v) => (RHO * v) / n), lamp: lamp.map((v) => (RHO * v) / n) };
  return site.cavern._bounce;
}

/** Every face of the cavern lit by its dark, the skylight it sees, its lamps (their own faces as they are) and the bounce
 *  of all of it round the hall; a sunlit corner keeps its sun (the shaft through the skylight). As caveLight, against the
 *  hour's bake (`open`). */
/** The light at a point (normal `n`) in the cavern, per channel, in the day's units: its dark and skylight, its lamps and
 *  the bounce of both, the lamps' raised against the hour's bake (`gain`). */
export function cavernLightAt(site, C, p, n, gain = 1) {
  const cave = cavernAsCave(site, C), Bn = bounceOf(site, C, cave), k = cavernSky(site, C, p, n), lm = lampLight(cave, p, n);
  return lm.map((v, ch) => k + Bn.sky[ch] + (v + Bn.lamp[ch]) * gain);
}

export function cavernLight(faces, site, C, { open = 1 } = {}) {
  const cave = cavernAsCave(site, C), gain = 1 / Math.max(0.12, open), Bn = bounceOf(site, C, cave);
  const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`, rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return faces.map((f) => {
    if (!f.fill || !f.corners || f.lamp || f.self) return f;
    const n = f.normal ?? [0, 0, 1], shares = Array.isArray(f.sunShare) ? f.sunShare : f.corners.map(() => f.sunShare ?? 0);
    const ks = f.corners.map((c, i) => {
      const sh = shares[i] ?? 0, q = [c[0] + n[0] * 0.1, c[1] + n[1] * 0.1, c[2] + n[2] * 0.1], k = cavernSky(site, C, q, n), lm = lampLight(cave, q, n);
      const all = sh + (1 - sh) * k, rgbK = lm.map((v, ch) => all + Bn.sky[ch] + (v + Bn.lamp[ch]) * gain), lum = 0.3 * rgbK[0] + 0.59 * rgbK[1] + 0.11 * rgbK[2];
      return { rgbK, share: sh > 0 ? sh / Math.max(1e-6, lum) : 0 };
    });
    const fills = (f.cornerFills ?? f.corners.map(() => f.fill)).map((c, i) => hex(rgb(c).map((v, ch) => v * ks[i].rgbK[ch])));
    const mean = [0, 1, 2].map((ch) => ks.reduce((a, q) => a + q.rgbK[ch], 0) / ks.length);
    return { ...f, fill: hex(rgb(f.fill).map((v, ch) => v * mean[ch])), cornerFills: fills, ...(f.sunShare !== undefined ? { sunShare: Array.isArray(f.sunShare) ? ks.map((q) => Math.round(q.share * 1e3) / 1e3) : Math.round((ks.reduce((a, q) => a + q.share, 0) / ks.length) * 1e3) / 1e3 } : {}) };
  });
}

/**
 * The CRACKS in its ceiling: jagged slits over the walk where a thread of day comes in, more as `cracks` is more. Each a
 * run of short legs across the ceiling (`pts`), its light a lamp of its own every leg (`kind: 'crack'`, era/cave.js
 * CRACK: daylight's colour, laid on what can see it) just under the rock. Memoised. → [{ pts, lamps }]
 */
export function cavernCracks(site, C, seed = 1) {
  if (site.cavern._cracks) return site.cavern._cracks;
  const z = cavernDome(site, C), n = Math.round(C.cracks * site.D / 9), out = [];
  for (let k = 0; k < n; k++) {
    const y0 = 4 + hash(k, 1, seed + 601) * (site.D - 8), x0 = site.trailX(y0) + (hash(k, 2, seed + 603) - 0.5) * 18;
    let a = hash(k, 3, seed + 607) * Math.PI, p = [x0, y0];
    const pts = [p.map(r5)], legs = 4 + Math.floor(hash(k, 4, seed + 609) * 4);
    for (let i = 0; i < legs; i++) { a += (hash(k, 10 + i, seed + 611) - 0.5) * 1.1; const l = 1 + 0.8 * hash(k, 30 + i, seed + 613); p = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l]; pts.push(p.map(r5)); }
    if (pts.some(([x, y]) => x < site.grid.x0 + 1 || x > site.W - 1 || y < 1 || y > site.D - 1)) continue;
    const lamps = pts.slice(1).map((q, i) => { const m = [(q[0] + pts[i][0]) / 2, (q[1] + pts[i][1]) / 2]; return { at: [r5(m[0]), r5(m[1]), r5(z(...m) - 0.4)], kind: 'crack' }; });
    out.push({ pts, lamps });
  }
  site.cavern._cracks = out;
  return out;
}

/** The cracks drawn: each leg a thin slit on the ceiling's underside, bright, its own light. */
export function crackFaces(site, C) {
  const z = cavernDome(site, C), out = [];
  for (const c of cavernCracks(site, C)) for (let i = 0; i + 1 < c.pts.length; i++) {
    const [a, b] = [c.pts[i], c.pts[i + 1]], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d) || 1, w = [(-d[1] / l) * 0.18, (d[0] / l) * 0.18];
    const cs = [[a[0] - w[0], a[1] - w[1]], [b[0] - w[0], b[1] - w[1]], [b[0] + w[0], b[1] + w[1]], [a[0] + w[0], a[1] + w[1]]].map(([x, y]) => [r5(x), r5(y), r5(z(x, y) - 0.08)]);
    out.push({ corners: cs, normal: [0, 0, -1], group: 'cave:lamp', fill: '#e6f1ff', lamp: true });
  }
  return out;
}

// ── its floor: soil, scree by its rocks, the walk ──────────────────────────────────────────────────────────────────────
/**
 * The cavern's FLOOR. Its ground is SOIL, the walk packed earth and the floor off it a darker dirt; SCREE lies round its
 * rocks (at the walls' feet, round its formations, its boulders and the stones strewn on it), rubble nearest; and the
 * walk is broken by stretches of the rock it runs through (worn bedrock, a limestone pavement; flagstones; plates) and
 * patched with gravel. Its edge frays face by face into the floor's dirt. Each surface a tile in the cube's own soil or
 * rock, each face lit by the cavern's own light.
 *   FLOOR                                    the surfaces: their cut, the metres each is laid at, soil's or rock's
 *   floorKind(site, x, y, seed, near)        which surface a point of the floor is; `near(x, y)` metres to its nearest rock
 *   floorDress(faces, site, st, C, { open, seed, rocks })  the floor's faces dressed: each its surface's tile, its fill the
 *                                            cavern's own light at its corners (cavernLightAt); `rocks` [{ x, y, r }]
 */
export const FLOOR = Object.freeze({
  soil: Object.freeze({ gen: 'dressed', cut: 'path', metres: 1.5, grit: 0.5, tone: 1, of: 'soil' }),
  dirt: Object.freeze({ gen: 'dressed', cut: 'path', metres: 1.8, grit: 0.7, tone: 0.78, of: 'soil' }),
  bedrock: Object.freeze({ gen: 'dressed', cut: 'karst', metres: 3.6, rows: 3, cols: 2, grit: 0.5, tone: 1.1 }),
  flags: Object.freeze({ gen: 'flagstone', metres: 2.4, cells: 5, wobble: 2.5, lost: 0.08, cracked: 0.25, tone: 1.05 }),
  plates: Object.freeze({ gen: 'dressed', cut: 'scree', form: 'plates', metres: 1.8, grit: 0.5, tone: 0.95 }),
  gravel: Object.freeze({ gen: 'dressed', cut: 'gravel', metres: 1.2, grit: 0.6, tone: 1 }),
  rubble: Object.freeze({ gen: 'dressed', cut: 'scree', form: 'rubble', metres: 1.5, grit: 0.7, tone: 0.85 }),
  scree: Object.freeze({ gen: 'dressed', cut: 'scree', form: 'blocks', metres: 1.5, grit: 0.7, tone: 0.8 }),
});
// the walk's rocky stretches, in the order its along-noise runs through them
const WALK = ['bedrock', 'flags', 'plates'];
// how near a rock its scree lies (metres, its noise's reach on it), its rubble nearer
const SCREE = Object.freeze({ reach: 1.4, vary: 1.0, rubble: 0.5, least: 0.32 });

/** Each surface's tile, in the cube's soil or rock: its family and the metres it is laid at. Memoised by their colours. */
const tiles = new Map();
function floorTiles(st) {
  const ramp = (r, d) => { const R = r ?? d; return [R[Math.floor(R.length / 2)], R[Math.max(0, Math.floor(R.length / 2) - 1)]]; };
  const rock = ramp(st.palette?.rock, [[96, 92, 88], [128, 124, 118], [160, 156, 150]]), soil = ramp(st.palette?.soil, [[88, 70, 52], [120, 96, 72], [150, 124, 96]]);
  const k = JSON.stringify([rock, soil]);
  if (tiles.has(k)) return tiles.get(k);
  const c = (rgb, t) => rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * t))));
  const out = Object.fromEntries(Object.entries(FLOOR).map(([id, F]) => {
    const { gen, metres, tone, of, ...o } = F, [mid, dark] = of === 'soil' ? soil : rock, stone = c(mid, tone), mortar = c(dark, tone * 0.8);
    const spec = gen === 'flagstone' ? { gen, stone, mortar, gravel: c(dark, 0.9), cells: o.cells, wobble: o.wobble, lost: o.lost, cracked: o.cracked, seed: 7 } : { gen, stone, mortar, ...o, seed: 7, scale: metres };
    return [id, { family: tileFamilyOf(spec, `cavern floor ${id}`), metres }];
  }));
  tiles.set(k, out);
  return out;
}

export function floorKind(site, x, y, seed = 1, near = () => Infinity) {
  const d = site.trailDist(x, y) / Math.max(0.5, site.halfWAt(y)), cell = hash(Math.floor(x * 2), Math.floor(y * 2), seed + 701);
  // round its rocks, scree, rubble nearest: how near is the rock's, its reach the noise's
  const r = near(x, y), reach = SCREE.reach + SCREE.vary * (vnoise(x * 0.4, y * 0.4, seed + 703) - 0.5) * 2;
  if (r < SCREE.rubble) return 'rubble';
  if (r < reach) return cell < (r - SCREE.rubble) / Math.max(0.1, reach - SCREE.rubble) ? 'dirt' : 'scree';
  // off the walk, its dirt; its edge frayed into it face by face
  if (d > 1.15) return 'dirt';
  const edge = 0.7 + 0.25 * (vnoise(x * 0.5, y * 0.5, seed + 707) - 0.5);
  if (d > edge && cell < (d - edge) / (1.15 - edge)) return 'dirt';
  // the walk: soil, broken by stretches of its rock along it, a patch of gravel here and there
  if (vnoise(x * 0.35, y * 0.35, seed + 709) > 0.86) return 'gravel';
  // (a value noise keeps to its middle: stretched, so a stretch of rock comes round along a trail a third of the way)
  const n = Math.max(0, Math.min(0.999, (vnoise(0.5, y * 0.045, seed + 711) - 0.22) / 0.56));
  return n < 0.66 ? 'soil' : WALK[Math.floor(((n - 0.66) / 0.34) * WALK.length)];
}

/** Metres to the nearest rock of a list ([{ x, y, r }], each `r` its reach), read off a grid of 2 m cells; and to the
 *  cavern's walls (the far cliff's foot, the open side's wall's), which are rock too. */
function nearRock(site, rocks) {
  const C = 2, cells = new Map(), key = (i, j) => `${i},${j}`;
  // (a rock sheds scree as it is big: a pebble strewn on the walk none)
  for (const q of rocks.filter((r) => r.r >= SCREE.least)) { const k = key(Math.floor(q.x / C), Math.floor(q.y / C)); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(q); }
  return (x, y) => {
    let best = Math.min(Math.max(0, x - site.cliffX(y) - 0.5), Math.max(0, site.trailX(y) + site.halfWAt(y) + site.fringeAt(y) + CAVERN.gap - x));
    const i0 = Math.floor(x / C), j0 = Math.floor(y / C);
    for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) for (const q of cells.get(key(i, j)) ?? []) best = Math.min(best, Math.max(0, Math.hypot(x - q.x, y - q.y) - q.r));
    return best;
  };
}

// what a floor face lit by the whole day would carry: its tile at its own colour (the page draws tile × fill)
const FLOOR_WHITE = 0.85;
export function floorDress(faces, site, st, C, { open = 1, seed = 1, rocks = [] } = {}) {
  const T = floorTiles(st), gain = 1 / Math.max(0.12, open), near = nearRock(site, rocks), hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  return faces.map((f) => {
    // (the hall's floor only, between the far cliff and the wall raised on its open side, inside its ends: up on the walls'
    // tops and the plateau, under the ceiling, the land is the rock's)
    if (!f.fill || !f.corners || f.lamp || f.texture || !/^isekai:(trail|scree)$/.test(f.group) || !f.normal || f.normal[2] < 0.5) return f;
    const m = [0, 1].map((k) => f.corners.reduce((s, c) => s + c[k], 0) / f.corners.length);
    if (m[0] < site.cliffX(m[1]) + 0.5 || m[0] > site.trailX(m[1]) + site.halfWAt(m[1]) + site.fringeAt(m[1]) + CAVERN.gap + 1 || m[1] < CAVERN.endRun * 0.5 || m[1] > site.D - CAVERN.endRun * 0.5) return f;
    const kind = floorKind(site, m[0], m[1], seed, near), t = T[kind];
    // (its light the cavern's own at each corner, the tile its colour: what the bake laid under the ceiling is the
    // cavern's light, nothing of the day's but its cracks and skylight; one of the tile's four variants a cell)
    const lit = f.corners.map((c) => hex(cavernLightAt(site, C, [c[0], c[1], c[2] + 0.1], f.normal, gain).map((v) => 255 * FLOOR_WHITE * Math.min(1.4, v))));
    const mean = hex([1, 3, 5].map((i) => lit.reduce((a, h) => a + parseInt(h.slice(i, i + 2), 16), 0) / lit.length));
    const v = 'abcd'[Math.floor(hash(Math.floor(m[0] / t.metres), Math.floor(m[1] / t.metres), seed + 713) * 4)];
    const { sunShare: _s, ...rest } = f;
    return { ...rest, texture: `${t.family}-${v}`, textureLit: true, uv: f.corners.map((c) => [r5(c[0] / t.metres), r5(c[1] / t.metres)]), fill: mean, cornerFills: lit, floor: kind };
  });
}

/**
 * Its WALL ROCKS: small rocks heaped along the foot of every wall (the far cliff's, the open side's), a step apart, one to
 * three a step, most small, out of the walk: what has come down off the rock. → [{ x, y, z0, s, v }] (`s` metres across)
 */
export const WALL_ROCKS = Object.freeze({ step: 1.1, most: 3, size: [0.3, 1.1], reach: 1.8 });
export function wallRocks(site, C, seed = 1) {
  const out = [], W = WALL_ROCKS;
  let v = 30000;
  // (a wall's foot: from behind its face, out over it, the first place past a steep step the land lies level, a quarter
  // metre at a time; the land over the wall is level too, so the face must be passed first)
  const footOf = (x0, dir, y) => {
    let x = x0, steep = false;
    for (let k = 0; k < 60; k++, x += dir * 0.25) { const dz = Math.abs(site.ground(x + dir * 0.25, y) - site.ground(x, y)); if (dz >= 0.12) steep = true; else if (steep) return x; }
    return x;
  };
  for (let y = CAVERN.endRun; y < site.D - CAVERN.endRun; y += W.step) {
    const foot = [footOf(site.cliffX(y) - 3, 1, y), footOf(site.trailX(y) + site.halfWAt(y) + site.fringeAt(y) + CAVERN.gap + CAVERN.face, -1, y)];
    foot.forEach((fx, side) => {
      const n = 1 + Math.floor(hash(Math.round(y * 10), side, seed + 801) * W.most);
      for (let k = 0; k < n; k++, v++) {
        const out1 = W.reach * hash(v, 1, seed + 803) ** 1.5, x = side ? fx - out1 : fx + out1, yy = y + (hash(v, 2, seed + 807) - 0.5) * W.step;
        if (site.trailDist(x, yy) < site.halfWAt(yy) + 0.8) continue;
        const s = W.size[0] + (W.size[1] - W.size[0]) * hash(v, 3, seed + 809) ** 2;
        out.push({ x: r5(x), y: r5(yy), z0: r5(site.ground(x, yy)), s: r5(s), v });
      }
    });
  }
  return out;
}

/** A cavern's walk's edge strewn (local-meru/broken-land.js strewEdge's numbers): stones every step heaped evenly both
 *  sides, bigger, reaching twice a dirt trail's way out over the floor and further in on the walk, so the walk and the
 *  scree off it run into one another under them and no line shows between. */
export const CAVERN_EDGE = Object.freeze({ step: 0.45, heap: 5, out: 2.4, in: 0.7, size: [0.12, 0.75], most: 2000, even: 0.6 });
