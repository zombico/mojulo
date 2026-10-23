/**
 * THE STRAND — what lies on sand (era/substrate.js): shells, driftwood, sea pebbles, and the dune grass that holds it.
 * Rows first: a kind is a row (its read, the ground it lies on, whether it needs a shore, the climates it suits); its
 * builder makes one piece as small faces in the kit's own colours (no new hue: a shell the sand's light end or the
 * rock's dark, driftwood the rock's light end bleached toward the sand, a pebble the rock's).
 *
 *   STRAND                     { <kind>: { read, on, shore, climates, size: [lo, hi] (m) } }
 *   strandPiece(kind, it)      → faces (group `isekai:strand`, each its `part` and its `value` in its part's ramp) for
 *                                one piece at it { x, y, z, size, yaw, v } on ground `heightAt` (driftwood follows it)
 *   strandFill(st, f, lit, away) → the stop of its part's ramp: a stop up in the sun, a stop down turned from it
 *   strewStrand(st, { cells, cell, heightAt, seed, grit, keep, shore, on, kinds }) → pieces [{ kind, faces, at }] over
 *                                sand cells ([x, y] centres, `cell` m across; a piece only where `on([x, y])`): pebbles in drifts, driftwood now and then, shells only
 *                                where `shore(x, y)` says the tide reaches (none without one)
 *   duneGrass(st, { cells, cell, heightAt, seed, keep, avoid, on }) → tufts [{ x, y, z, h, yaw, v }] of marram (vegetation/grass.js)
 *                                in sparse clumps; duneGrassFaces(st, tufts, litAt, nearAt) → their faces in the kit's grass
 *                                leaned to its sand
 *
 * Pure: hashed dice only. Nothing here runs unless a land has sand.
 */
import { hash3, vnoise } from './dirt.js';
import { P, r5 } from './geom.js';
import { kept } from './reserve.js';
import { tube } from './nature.js';
import { grassLadder } from '../vegetation/grass.js';

const TT = ['temperate', 'tropical'], TBT = ['temperate', 'boreal', 'tropical'], TB = ['temperate', 'boreal'];
export const STRAND = Object.freeze({
  shells: Object.freeze({ read: 'shells in drifts along the tide line: cockles and clams, a dark mussel among them', on: ['sand'], shore: true, climates: TT, size: [0.025, 0.06] }),
  driftwood: Object.freeze({ read: 'bleached driftwood thrown up on the sand, half buried, a stub of branch', on: ['sand'], shore: false, climates: TBT, size: [0.6, 1.9] }),
  'sea-pebbles': Object.freeze({ read: 'rounded pebbles lying in drifts', on: ['sand'], shore: false, climates: TB, size: [0.03, 0.09] }),
});
export const STRAND_GROUP = 'isekai:strand', DUNE_GROUP = 'isekai:dune';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mean = (cs) => cs.reduce((a, p) => [a[0] + p[0] / cs.length, a[1] + p[1] / cs.length, a[2] + p[2] / cs.length], [0, 0, 0]);
/** A face from its corners, its normal turned out from `from`. */
function face(cs, from, part, value) {
  let n = unit(cross(sub(cs[1], cs[0]), sub(cs[cs.length - 1], cs[0])));
  const m = mean(cs); if ((m[0] - from[0]) * n[0] + (m[1] - from[1]) * n[1] + (m[2] - from[2]) * n[2] < 0) n = n.map((v) => -v);
  return { corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), group: STRAND_GROUP, part, value: r5(value) };
}

/** One piece of a kind. */
export function strandPiece(kind, it, heightAt = () => it.z) {
  const h = (k) => hash3(it.v, k, 4211), rot = (x, y) => [it.x + x * Math.cos(it.yaw) - y * Math.sin(it.yaw), it.y + x * Math.sin(it.yaw) + y * Math.cos(it.yaw)];
  const out = [], s = it.size;
  if (kind === 'sea-pebbles') {
    // a flattened egg: a sunk foot, a belly, a shoulder, the crown; 5 or 6 round
    const n = h(1) < 0.5 ? 5 : 6, ry = 0.6 + 0.3 * h(2), ht = s * (0.32 + 0.18 * h(3)), value = 0.25 + 0.6 * h(4);
    const rings = [[-0.25, 0.8], [0.3, 1], [0.78, 0.7]].map(([t, r]) => Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * (i + 0.2 * h(10 + i))) / n, [x, y] = rot(Math.cos(a) * r * s * 0.5, Math.sin(a) * r * s * 0.5 * ry);
      return [x, y, it.z + t * ht];
    }));
    const c = [it.x, it.y, it.z + 0.35 * ht], top = [it.x, it.y, it.z + ht];
    for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < n; i++) out.push(face([rings[r][i], rings[r][(i + 1) % n], rings[r + 1][(i + 1) % n], rings[r + 1][i]], c, 'pebble', value));
    for (let i = 0; i < n; i++) out.push(face([top, rings[2][i], rings[2][(i + 1) % n]], c, 'pebble', value));
    return out;
  }
  if (kind === 'shells') {
    // a clam's fan: the hinge, a rim of seven round the far side, the boss domed over them — lying humped, or a third
    // of them cupped up, their pale inside showing; one in six a dark mussel (the rock's ramp)
    const cup = h(1) < 0.33, mussel = h(2) < 0.16, part = mussel ? 'mussel' : 'shell', value = mussel ? 0.12 + 0.15 * h(3) : 0.72 + 0.25 * h(3);
    const len = mussel ? 1.6 : 1, rim = Array.from({ length: 7 }, (_, i) => {
      const a = (-0.62 + (1.24 * i) / 6) * Math.PI, [x, y] = rot(Math.cos(a) * s * 0.5 * len, Math.sin(a) * s * 0.5);
      return [x, y, it.z + (cup ? s * 0.16 : 0.002)];
    });
    const [hx, hy] = rot(-s * 0.42 * len, 0), [ux, uy] = rot(-s * 0.1, 0), hinge = [hx, hy, it.z + 0.004], boss = [ux, uy, it.z + (cup ? 0.004 : s * 0.2)];
    const below = [it.x, it.y, it.z - s];
    // (its ribs: every other wedge a shade apart)
    for (let i = 0; i + 1 < rim.length; i++) out.push(face([boss, rim[i], rim[i + 1]], cup ? [it.x, it.y, it.z + s] : below, cup && !mussel ? 'inside' : part, value + (i % 2 ? 0.08 : 0)));
    out.push(face([boss, hinge, rim[0]], below, part, value), face([boss, rim[6], hinge], below, part, value));
    return out;
  }
  if (kind === 'driftwood') {
    // a bowed limb lying along `yaw`, sunk a third of its girth, tapering; its ends capped, a stub of branch from it
    const L = s, r0 = 0.035 + 0.06 * h(1), bow = (h(2) - 0.5) * 0.18 * L, value = 0.62 + 0.3 * h(3), pts = [], radii = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4, [x, y] = rot((t - 0.5) * L, bow * 4 * t * (1 - t)), r = r0 * (1 - 0.4 * t);
      pts.push([x, y, heightAt(x, y) + r * 0.35 + 0.03 * Math.sin(t * Math.PI) * h(4)]); radii.push(r);
    }
    const wood = (f) => ({ corners: f.corners, normal: f.normal.map(r5), outNormal: f.normal.map(r5), group: STRAND_GROUP, part: 'wood', value: r5(value), doubleSided: true });
    const raw = []; tube(raw, pts, radii, 6, null, STRAND_GROUP);
    // (its ends capped: a ring's six round its centre)
    for (const k of [0, 4]) out.push(face(raw.filter((_, i) => Math.floor(i / 6) === (k ? 3 : 0)).map((f) => f.corners[k ? 2 : 0]), k ? pts[3] : pts[1], 'wood', value));
    for (const f of raw) out.push(wood(f));
    if (h(5) < 0.7) {
      const t = 0.3 + 0.3 * h(6), k = Math.min(3, Math.floor(t * 4)), a = pts[k], d = unit(sub(pts[k + 1], pts[k])), side = h(7) < 0.5 ? 1 : -1;
      const off = unit([d[0] * 0.6 - d[1] * side, d[1] * 0.6 + d[0] * side, 0.15]), b = [a[0] + off[0] * L * 0.22, a[1] + off[1] * L * 0.22, a[2] + off[2] * L * 0.22];
      const raw2 = []; tube(raw2, [a, b], [radii[k] * 0.45, radii[k] * 0.25], 5, null, STRAND_GROUP);
      for (const f of raw2) out.push(wood(f));
    }
    return out;
  }
  throw new Error(`strand: no kind '${kind}' (${Object.keys(STRAND).join(', ')})`);
}

// a part's ramp in the kit's palette: the sand's (the soil's without one), the rock's, and the rock's light end bleached
// toward the sand
const PARTS = { shell: 'sand', inside: 'sand', mussel: 'rock', pebble: 'rock', wood: 'bleached' };
const rampOf = (st, part) => {
  const sand = st.palette.sand ?? st.palette.soil, rock = st.palette.rock, p = PARTS[part];
  if (p === 'sand') return sand;
  if (p === 'rock') return rock;
  return rock.map((c, i) => { const s = sand[Math.min(sand.length - 1, Math.round((i * (sand.length - 1)) / (rock.length - 1)))]; return c.map((v, j) => Math.round(0.5 * v + 0.5 * s[j])); });
};
export function strandFill(st, f, lit, away) {
  const ramp = rampOf(st, f.part), n = ramp.length;
  return ramp[Math.max(0, Math.min(n - 1, Math.round(f.value * (n - 1)) + (lit ? 1 : 0) - (away ? 1 : 0)))];
}

// how much: a sand cell's chance of a pebble drift's heart, the drift's stones; driftwood a square metre; shells along a
// shore a square metre; the most of each
export const STREW = Object.freeze({ drift: 0.6, stones: [2, 7], driftwood: 0.004, shells: 1.6, most: { 'sea-pebbles': 900, driftwood: 14, shells: 900 } });

/** The strand over sand cells. */
export function strewStrand(st, { cells, cell, heightAt, seed, grit = 0, keep = null, shore = null, on = () => true, kinds = Object.keys(STRAND) }) {
  const out = [], n = Object.fromEntries(kinds.map((k) => [k, 0])), H = (a, b) => hash3(a, b, seed + 4241), A = cell * cell, more = 0.6 + 0.8 * grit;
  const put = (kind, x, y, size, v, yaw) => {
    if (n[kind] >= STREW.most[kind] || !kept(keep, x, y, 0.3) || !on([x, y])) return;
    n[kind]++; out.push({ kind, at: [r5(x), r5(y)], faces: strandPiece(kind, { x, y, z: heightAt(x, y), size, yaw, v }, heightAt) });
  };
  const size = (kind, u) => { const [lo, hi] = STRAND[kind].size; return lo + (hi - lo) * u * u; };
  cells.forEach(([cx, cy], ci) => {
    // pebbles in drifts: a slow noise's highs, the stones heaped about the cell
    if (n['sea-pebbles'] !== undefined && vnoise(cx / 5, cy / 5, seed + 4243) > STREW.drift && H(ci, 1) < 0.7) {
      const m = STREW.stones[0] + Math.floor(H(ci, 2) * (STREW.stones[1] - STREW.stones[0] + 1) * more);
      for (let j = 0; j < m; j++) { const k = ci * 16 + j; put('sea-pebbles', cx + (H(k, 3) - 0.5) * cell, cy + (H(k, 4) - 0.5) * cell, size('sea-pebbles', H(k, 5)), 60000 + k, 2 * Math.PI * H(k, 6)); }
    }
    if (n.driftwood !== undefined && H(ci, 7) < STREW.driftwood * A) put('driftwood', cx, cy, size('driftwood', H(ci, 8)), 70000 + ci, 2 * Math.PI * H(ci, 9));
    // shells only where the tide reaches
    if (n.shells !== undefined && shore && shore(cx, cy)) {
      const m = Math.floor(STREW.shells * A * more * (0.3 + 1.4 * vnoise(cx / 3, cy / 3, seed + 4247)) + H(ci, 10));
      for (let j = 0; j < m; j++) { const k = ci * 16 + j; put('shells', cx + (H(k, 11) - 0.5) * cell, cy + (H(k, 12) - 0.5) * cell, size('shells', H(k, 13)), 80000 + k, 2 * Math.PI * H(k, 14)); }
    }
  });
  return out;
}

// dune grass: a clump's heart where a slow noise is high, its tufts round it; how tall (m), the most
export const DUNE = Object.freeze({ over: 0.56, chance: 0.5, tufts: [2, 6], spread: 0.9, height: [0.55, 1.05], most: 320, variants: 3 });

/** Marram over sand cells, in clumps, clear of `avoid` ([{ x, y, r }]) and claimed ground. */
export function duneGrass(st, { cells, cell, heightAt, seed, keep = null, avoid = [], on = () => true }) {
  const out = [], H = (a, b) => hash3(a, b, seed + 4261);
  cells.forEach(([cx, cy], ci) => {
    if (out.length >= DUNE.most || vnoise(cx / 6, cy / 6, seed + 4263) < DUNE.over || H(ci, 1) > DUNE.chance * cell * cell / 2) return;
    const m = DUNE.tufts[0] + Math.floor(H(ci, 2) * (DUNE.tufts[1] - DUNE.tufts[0] + 1));
    for (let j = 0; j < m && out.length < DUNE.most; j++) {
      const k = ci * 8 + j, a = 2 * Math.PI * H(k, 3), r = DUNE.spread * Math.sqrt(H(k, 4)), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (!kept(keep, x, y, 0.3) || !on([x, y]) || avoid.some((q) => Math.hypot(q.x - x, q.y - y) < q.r)) continue;
      out.push({ x: r5(x), y: r5(y), z: r5(heightAt(x, y) - 0.03), h: r5(DUNE.height[0] + (DUNE.height[1] - DUNE.height[0]) * H(k, 5)), yaw: r5(2 * Math.PI * H(k, 6)), v: k % DUNE.variants });
    }
  });
  return out;
}

/** The tufts' faces: the marram's ladder (L1 where `nearAt(x, y)`, L0 past), its colour's place along the kit's grass
 *  ramp leaned halfway to its sand, a stop up where `litAt` says the sun reaches the tuft. */
export function duneGrassFaces(st, tufts, litAt, nearAt = () => false) {
  if (!tufts.length) return [];
  const lad = Array.from({ length: DUNE.variants }, (_, v) => grassLadder('marram', { seed: 23 + 41 * v })), grass = st.palette.grass, sand = st.palette.sand ?? st.palette.soil;
  const ramp = grass.map((c, i) => { const s = sand[Math.min(sand.length - 1, Math.round((i * (sand.length - 1)) / (grass.length - 1)))]; return c.map((v, j) => Math.round(0.5 * v + 0.5 * s[j])); });
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], out = [];
  for (const t of tufts) {
    const level = nearAt(t.x, t.y) ? 'L1' : 'L0', tris = lad[t.v][level], lit = litAt([t.x, t.y, t.z + t.h * 0.6]);
    const top = Math.max(...tris.map((q) => lum(q.c))) || 1, cy = Math.cos(t.yaw), sy = Math.sin(t.yaw);
    for (const q of tris) {
      const cs = q.p.map((p) => [t.x + (p[0] * cy - p[1] * sy) * t.h, t.y + (p[0] * sy + p[1] * cy) * t.h, t.z + p[2] * t.h]);
      const k = Math.max(0, Math.min(ramp.length - 1, Math.round((lum(q.c) / top) * (ramp.length - 2)) + (lit ? 1 : 0)));
      const n = unit([q.n[0] * cy - q.n[1] * sy, q.n[0] * sy + q.n[1] * cy, q.n[2]]);
      out.push({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), group: DUNE_GROUP, doubleSided: true, rgb: ramp[k] });
    }
  }
  return out;
}
