/**
 * ROCK FLORA — what grows on bare rock and scree (era/substrate.js): lichen crusting it, cushion plants and stonecrop
 * rooted in its joints, small ferns in the shaded ones. Rows first: a kind is a row (its read, the ground it grows on,
 * the climates it suits, its size); its builder makes one piece as small faces in the kit's own ramps (no new hue: a
 * lichen the rock's light end leaned to the grass, or the gold's; a cushion the foliage's, its flowers a petal ramp the
 * kit has; stonecrop the foliage leaned to the rock; a fern the foliage's low end).
 *
 *   ROCK_FLORA                    { <kind>: { read, on, climates, size: [lo, hi] (m), joint (roots in a joint) } }
 *   rockPiece(kind, it, palette)  → faces (group `isekai:rockflora`, each its `part` and `value`) for one piece at
 *                                   it { p: [x, y, z], n (the face it lies on; up by default), size, yaw, v }
 *   rockFloraFill(st, f, lit, away) → its part's ramp's stop: a stop up in the sun, a stop down turned from it
 *   growRockFlora(st, { cells, cell, talus, caps, heightAt, seed, grit, keep, on, joints, shadeAt }) → pieces
 *                                   [{ kind, at, faces }]: lichen on the pavement's clints (`cells`, the turned cells'
 *                                   centres), the boulders' and stones' caps (`caps`, their faces) and the talus (`talus`,
 *                                   its faces' middles); the clumps on the pavement in its joints (`joints`, the karst
 *                                   tile's: matte-paint/karst.js; without one, anywhere on it), the ferns where
 *                                   `shadeAt(p)` says the sun does not reach; cushions between the talus's stones
 *
 * Pure: hashed dice only. Nothing here runs unless a land names its formation.
 */
import { hash3 } from './dirt.js';
import { P, r5 } from './geom.js';
import { kept } from './reserve.js';
import { flowerRamp } from '../vegetation/wildflowers.js';
import { KARST_GRIKE } from '../matte-paint/dressed.js';

const AB = ['alpine', 'boreal'], ALL = ['temperate', 'alpine', 'boreal', 'arid', 'tropical'];
export const ROCK_FLORA = Object.freeze({
  'lichen-crust': Object.freeze({ read: 'flat crusts and rosettes over the rock and the loose stones, grey-green and gold', on: ['bedrock', 'scree'], climates: ALL, size: [0.025, 0.12], joint: false }),
  'cushion-plant': Object.freeze({ read: 'tight domes of moss campion and saxifrage, flowering, between the stones and in the joints', on: ['bedrock', 'scree'], climates: ['temperate', ...AB], size: [0.08, 0.26], joint: true }),
  stonecrop: Object.freeze({ read: 'fleshy rosettes of sedum and houseleek in mats along the cracks', on: ['bedrock'], climates: ['temperate', 'arid', 'alpine'], size: [0.03, 0.07], joint: true }),
  'crevice-fern': Object.freeze({ read: 'small ferns rooted in the shaded joints, their fronds arching out', on: ['bedrock'], climates: ['temperate', 'tropical'], size: [0.14, 0.34], joint: true }),
});
export const ROCK_FLORA_GROUP = 'isekai:rockflora';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mean = (cs) => cs.reduce((a, p) => [a[0] + p[0] / cs.length, a[1] + p[1] / cs.length, a[2] + p[2] / cs.length], [0, 0, 0]);
/** A face from its corners, its normal turned toward `toward`. */
function face(cs, toward, part, value, extra = {}) {
  let n = unit(cross(sub(cs[1], cs[0]), sub(cs[cs.length - 1], cs[0])));
  if (n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] < 0) n = mul(n, -1);
  return { corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), group: ROCK_FLORA_GROUP, part, value: r5(value), ...extra };
}

/** One piece of a kind. */
export function rockPiece(kind, it, palette = {}) {
  const h = (k) => hash3(it.v, k, 4307), n = unit(it.n ?? [0, 0, 1]), s = it.size, out = [];
  // the frame on the face it lies on: e1, e2 across it, turned by the piece's yaw
  const a0 = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], b1 = unit(cross(n, a0)), b2 = cross(n, b1);
  const e1 = add(mul(b1, Math.cos(it.yaw)), mul(b2, Math.sin(it.yaw))), e2 = cross(n, e1);
  const at = (u, w, up) => add(add(add(it.p, mul(e1, u)), mul(e2, w)), mul(n, up));
  if (kind === 'lichen-crust') {
    // a crust: a ragged disc lying a hair off the rock, a paler (or darker) rosette at its heart; grey-green or gold
    const m = 11, gold = h(1) < 0.2, part = gold ? 'gold' : 'lichen', value = gold ? 0.35 + 0.25 * h(2) : 0.45 + 0.3 * h(2);
    const rim = Array.from({ length: m }, (_, i) => { const a = (2 * Math.PI * i) / m, r = s * 0.5 * (0.65 + 0.45 * h(10 + i)); return at(Math.cos(a) * r, Math.sin(a) * r, 0.004); });
    out.push(face(rim, n, part, value));
    const core = Array.from({ length: 7 }, (_, i) => { const a = (2 * Math.PI * i) / 7 + h(3), r = s * 0.2 * (0.7 + 0.5 * h(30 + i)); return at(Math.cos(a) * r, Math.sin(a) * r, 0.0055); });
    out.push(face(core, n, part, value + (h(4) < 0.6 ? 0.08 : -0.1)));
    return out;
  }
  if (kind === 'cushion-plant') {
    // a dome: three rings of eight and its crown, a little lopsided; a scatter of flowers on its top in a petal ramp
    // the kit has (none, a green cushion)
    const sides = 8, ht = s * (0.32 + 0.12 * h(1)), value = 0.2 + 0.25 * h(2);
    const rings = [[0, 1], [0.45, 0.9], [0.82, 0.55]].map(([t, r]) => Array.from({ length: sides }, (_, i) => {
      const a = (2 * Math.PI * i) / sides, rr = r * s * 0.5 * (0.85 + 0.25 * h(10 + i));
      return at(Math.cos(a) * rr, Math.sin(a) * rr, t * ht - (t === 0 ? 0.01 : 0));
    }));
    const top = at(0, 0, ht), mid = at(0, 0, ht * 0.4);
    for (let r = 0; r < 2; r++) for (let i = 0; i < sides; i++) out.push(face([rings[r][i], rings[r][(i + 1) % sides], rings[r + 1][(i + 1) % sides], rings[r + 1][i]], sub(mean([rings[r][i], rings[r + 1][i]]), mid), 'cushion', value + 0.12 * r));
    for (let i = 0; i < sides; i++) out.push(face([top, rings[2][i], rings[2][(i + 1) % sides]], n, 'cushion', value + 0.3));
    if (flowerRamp('clover', 'petal', palette)) {
      const k = 3 + Math.floor(h(5) * 7);
      for (let j = 0; j < k; j++) {
        const a = 2 * Math.PI * h(40 + j), r = s * 0.32 * Math.sqrt(h(60 + j)), t = r / (s * 0.5), c = at(Math.cos(a) * r, Math.sin(a) * r, ht * (1 - t * t * 0.9) + 0.004), fr = 0.008 + 0.006 * h(80 + j);
        out.push(face(Array.from({ length: 5 }, (_, q) => add(c, add(mul(e1, Math.cos((2 * Math.PI * q) / 5) * fr), mul(e2, Math.sin((2 * Math.PI * q) / 5) * fr)))), n, 'bloom', 0.55 + 0.35 * h(100 + j)));
      }
    }
    return out;
  }
  if (kind === 'stonecrop') {
    // a rosette: an outer ring of fleshy leaves rising out from the heart and an inner ring standing up, each leaf a
    // keeled wedge (four triangles); a mat of them along the crack
    const value = 0.3 + 0.2 * h(1);
    for (const [ring, m, R, lift] of [[0, 8, 1, 0.22], [1, 5, 0.55, 0.5]]) for (let i = 0; i < m; i++) {
      const a = (2 * Math.PI * (i + 0.5 * ring)) / m + h(2), c = Math.cos(a), sn = Math.sin(a), r = R * s * 0.5;
      const P0 = (u, w, z) => at(u * c - w * sn, u * sn + w * c, z);
      const b = P0(0.1 * r, 0, 0.004), t = P0(r, 0, lift * r + 0.004), l = P0(0.55 * r, 0.22 * r, 0.1 * r), rr = P0(0.55 * r, -0.22 * r, 0.1 * r), k = P0(0.55 * r, 0, 0.1 * r + 0.18 * r);
      for (const tri of [[b, l, k], [b, k, rr], [l, t, k], [k, t, rr]]) out.push(face(tri, n, 'succulent', value + 0.15 * ring + (tri.includes(t) ? 0.1 : 0)));
    }
    return out;
  }
  if (kind === 'crevice-fern') {
    // fronds from the joint: each a spine arching up and out (four segments), a pinna either side of each, shrinking to
    // its tip; doubly sided
    const fronds = 4 + Math.floor(h(1) * 4), value = 0.08 + 0.17 * h(2);
    for (let f = 0; f < fronds; f++) {
      const az = (2 * Math.PI * f) / fronds + 0.5 * (h(10 + f) - 0.5), L = s * (0.7 + 0.3 * h(20 + f)), dir = [Math.cos(az), Math.sin(az)];
      const pts = [0, 1, 2, 3, 4].map((q) => { const t = q / 4, el = (75 - 60 * t) * (Math.PI / 180), d = L * t; return at(dir[0] * d * Math.cos(el * 0.6), dir[1] * d * Math.cos(el * 0.6), d * Math.sin(el) * 0.7 * (1 - 0.35 * t)); });
      for (let q = 0; q < 4; q++) {
        const a = pts[q], b = pts[q + 1], side = unit(cross(sub(b, a), n)), w = L * 0.16 * (1 - q / 4.5);
        for (const sg of [1, -1]) out.push(face([a, b, add(mean([a, b]), add(mul(side, sg * w), mul(n, -0.2 * w)))], n, 'frond', value + 0.04 * q, { doubleSided: true }));
      }
    }
    return out;
  }
  throw new Error(`rock flora: no kind '${kind}' (${Object.keys(ROCK_FLORA).join(', ')})`);
}

// a part's ramp in the kit's palette, a mix of two of its own where a part has none
const mixRamp = (a, b, k) => a.map((c, i) => { const q = b[Math.min(b.length - 1, Math.round((i * (b.length - 1)) / (a.length - 1)))]; return c.map((v, j) => Math.round(v + (q[j] - v) * k)); });
const rampOf = (st, part) => {
  const P0 = st.palette, leaf = P0.foliage ?? P0.grass;
  if (part === 'lichen') return mixRamp(P0.rock, P0.grass, 0.3);
  if (part === 'gold') return mixRamp(P0.gold ?? P0.soil, P0.rock, 0.5);
  if (part === 'cushion') return mixRamp(leaf, P0.grass, 0.5);
  if (part === 'bloom') return P0[flowerRamp('clover', 'petal', P0)];
  if (part === 'succulent') return mixRamp(leaf, P0.rock, 0.45);
  // (a fern in the joint's shade: the foliage's lower end, leaned a little to the rock)
  return mixRamp(leaf, P0.rock, 0.25);
};
export function rockFloraFill(st, f, lit, away) {
  const ramp = rampOf(st, f.part), n = ramp.length;
  return ramp[Math.max(0, Math.min(n - 1, Math.round(f.value * (n - 1)) + (lit ? 1 : 0) - (away ? 1 : 0)))];
}

// how much: lichens a pavement cell (at a grit of 1), a cap's chance of one, a talus face's; the joint plants' tries a
// pavement cell and each's share of the tries that land in a joint; a talus face's chance of a cushion; the most of each
export const GROW = Object.freeze({ lichen: 3, cap: 0.35, talus: 0.3, tries: 40, share: { stonecrop: 0.22, 'cushion-plant': 0.12, 'crevice-fern': 0.1 }, cushion: 0.05, mat: [2, 6],
  most: { 'lichen-crust': 1400, 'cushion-plant': 320, stonecrop: 1200, 'crevice-fern': 140 } });

/** The rock flora over a formation's rock ground. */
export function growRockFlora(st, { cells = [], cell = 1, talus = [], caps = [], heightAt, seed, grit = 0.5, keep = null, on = () => true, joints = null, shadeAt = () => false }) {
  const out = [], count = Object.fromEntries(Object.keys(ROCK_FLORA).map((k) => [k, 0])), H = (a, b) => hash3(a, b, seed + 4337), more = 0.5 + grit;
  const size = (kind, u) => { const [lo, hi] = ROCK_FLORA[kind].size; return lo + (hi - lo) * u * u; };
  const put = (kind, p, n, u, v, yaw) => {
    if (count[kind] >= GROW.most[kind] || !kept(keep, p[0], p[1], 0.3)) return;
    count[kind]++; out.push({ kind, at: [r5(p[0]), r5(p[1])], faces: rockPiece(kind, { p, n, size: size(kind, u), yaw, v }, st.palette) });
  };
  const inJoint = (x, y) => (joints ? joints.dist(x, y) < KARST_GRIKE.half : true), onClint = (x, y) => (joints ? joints.dist(x, y) > KARST_GRIKE.half + KARST_GRIKE.lip : true);
  cells.forEach(([cx, cy], ci) => {
    const m = Math.floor(GROW.lichen * more * cell * cell + H(ci, 1));
    for (let j = 0; j < m; j++) {
      const k = ci * 32 + j, x = cx + (H(k, 2) - 0.5) * cell, y = cy + (H(k, 3) - 0.5) * cell;
      if (on([x, y]) && onClint(x, y)) put('lichen-crust', [x, y, heightAt(x, y)], null, H(k, 4), 90000 + k, 2 * Math.PI * H(k, 5));
    }
    // the clumps: tries over the cell, kept where they fall in a joint, each try one kind by its share
    for (let j = 0; j < GROW.tries; j++) {
      const k = ci * 32 + 16 + j, x = cx + (H(k, 6) - 0.5) * cell, y = cy + (H(k, 7) - 0.5) * cell;
      if (!on([x, y]) || !inJoint(x, y)) continue;
      const u = H(k, 8), p = [x, y, heightAt(x, y) - 0.01];
      let acc = 0;
      for (const [kind, sh] of Object.entries(GROW.share)) {
        const w = kind === 'crevice-fern' ? (shadeAt(p) ? sh * 2 : sh * 0.3) : sh;
        if (u >= acc && u < acc + w) {
          // (stonecrop a mat of rosettes along the joint: each a step on, kept where it is still in the joint)
          if (kind === 'stonecrop') {
            const m = GROW.mat[0] + Math.floor(H(k, 11) * (GROW.mat[1] - GROW.mat[0] + 1));
            for (let q = 0; q < m; q++) { const qx = x + (H(k * 8 + q, 12) - 0.5) * 0.18, qy = y + (H(k * 8 + q, 13) - 0.5) * 0.18; if (on([qx, qy]) && inJoint(qx, qy)) put(kind, [qx, qy, heightAt(qx, qy) - 0.01], null, H(k * 8 + q, 14), 95000 + k * 8 + q, 2 * Math.PI * H(k * 8 + q, 15)); }
          } else put(kind, p, null, H(k, 9), 91000 + k, 2 * Math.PI * H(k, 10));
          break;
        }
        acc += w;
      }
    }
  });
  // the caps of the boulders and the stones: a lichen on a share of them, lying on the cap's own face
  caps.forEach((f, fi) => {
    if (H(fi, 11) > GROW.cap * more) return;
    const [a, b, c] = f.corners, u = H(fi, 12), w = H(fi, 13) * (1 - u), p = add(a, add(mul(sub(b, a), u), mul(sub(c, a), w)));
    put('lichen-crust', p, f.normal, H(fi, 14) * 0.6, 92000 + fi, 2 * Math.PI * H(fi, 15));
  });
  // the talus: lichen and now and then a cushion between its stones
  talus.forEach((q, ti) => {
    if (H(ti, 16) < GROW.talus * more) put('lichen-crust', [q[0], q[1], heightAt(q[0], q[1])], null, H(ti, 17) * 0.7, 93000 + ti, 2 * Math.PI * H(ti, 18));
    if (H(ti, 19) < GROW.cushion * more) put('cushion-plant', [q[0] + 0.2, q[1] - 0.15, heightAt(q[0] + 0.2, q[1] - 0.15) - 0.01], null, H(ti, 20), 94000 + ti, 2 * Math.PI * H(ti, 21));
  });
  return out;
}
