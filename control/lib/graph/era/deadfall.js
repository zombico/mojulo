/**
 * DEADFALL — what a tree lets fall: its dead branches and now and then a limb, lying under its crown where they fell, by
 * a trail (a stage's or a geocube path's `skandart` on open ground, beside its rockfall: era/skandart-land.js). Gravity
 * lays each flat on the ground under it, the way it came down: mostly pointing out from the trunk, its butt broken on the
 * slant, its forks lying out to either side, and one of them propped up off the ground, as a branch lies on its forks.
 *
 *   branch  a dead branch, a couple of metres, forked once or twice
 *   limb    a fallen limb, longer and thicker, forked more; one in so many of what a tree lets fall
 *
 * Each its stem a curved run of tapered five-sided tubes, its forks the same off its joints. Laid within its tree's
 * crown (and a little past it), none too thin to be read where it is seen (at half the eye spot thick: a stick reads by
 * its length), never across the walk's middle (a tip may reach its edge: `edge` of its half-width from
 * its line), never in a rock, nor on another; more of them the more is asked (`amount`), a tree's own share by its dice.
 *
 *   DEADFALL                                     the numbers
 *   deadfall(site, { amount, trees, rocks, read, seed }) → { pieces: [{ tree, kind, at, len, faces }], laws, claims }
 *     trees  [{ x, y, crown }]: each tree's foot and its crown's radius (those within `near` of the walk drop anything)
 *     rocks  [{ x, y, r }]: what stands on the land
 *   faces `{ corners, normal }` laid on the land (each over the ground under it, resting on it); `claims` [[x, y, r]] the
 *   ground each lies on, for the grass to keep off it.
 * Pure; seeded.
 */
import { hash3 } from './dirt.js';
import { r5 } from './geom.js';
import { skandartRead } from './skandart.js';

export const DEADFALL = Object.freeze({
  branch: Object.freeze({ len: Object.freeze([1.1, 2.4]), r: Object.freeze([0.03, 0.055]), forks: Object.freeze([1, 2]) }),
  limb: Object.freeze({ len: Object.freeze([2.4, 4.2]), r: Object.freeze([0.07, 0.12]), forks: Object.freeze([2, 4]) }),
  // a tree's most (at the amount's top), the share of them that are limbs, how far past its crown they lie (× its radius)
  most: 3, limbs: 0.25, reach: 1.15,
  // the trees that drop any (m from the walk), how far into the walk a tip may reach (of its half-width from its line), how
  // far apart two lie (m), the tubes' sides, a stem's taper (its tip's radius over its butt's), how far up a propped fork
  // rises (its pitch, radians)
  near: 9, edge: 0.75, apart: 0.7, sides: 5, taper: 0.35, prop: Object.freeze([0.3, 0.6]),
});

const mix = (a, b, t) => a + (b - a) * t;
const r5n = (v) => r5(v) + 0;

/** A tapered tube along `pts` (radii `rs`), each ring turned square to its run: quads between rings, the butt capped. */
function tube(pts, rs, sides, cap) {
  const rings = pts.map((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]], l = Math.hypot(...d) || 1, t = d.map((v) => v / l);
    // (a frame square to the run: its side level, its other up out of it)
    const s0 = [-t[1], t[0], 0], ls = Math.hypot(...s0) || 1, s = s0.map((v) => v / ls), u = [t[1] * s[2] - t[2] * s[1], t[2] * s[0] - t[0] * s[2], t[0] * s[1] - t[1] * s[0]];
    return Array.from({ length: sides }, (_, k) => { const a = (2 * Math.PI * k) / sides, c = Math.cos(a) * rs[i], n = Math.sin(a) * rs[i]; return [p[0] + s[0] * c + u[0] * n, p[1] + s[1] * c + u[1] * n, p[2] + s[2] * c + u[2] * n]; });
  });
  const faces = [];
  // (each with the point on its run it faces away from: its normal turned out)
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < sides; k++) { const k1 = (k + 1) % sides; faces.push({ cs: [rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k]], from: pts[i].map((v, c) => (v + pts[i + 1][c]) / 2) }); }
  if (cap) faces.push({ cs: [...rings[0]], from: pts[1] });
  return faces;
}
/** A face's corners and its normal (Newell's), turned away from `from` (its corners wound to match). */
const face = ({ cs, from }) => {
  const n = [0, 0, 0];
  cs.forEach((P, k) => { const Q = cs[(k + 1) % cs.length]; n[0] += (P[1] - Q[1]) * (P[2] + Q[2]); n[1] += (P[2] - Q[2]) * (P[0] + Q[0]); n[2] += (P[0] - Q[0]) * (P[1] + Q[1]); });
  const l = Math.hypot(...n) || 1, m = cs.reduce((a, c) => a.map((v, i) => v + c[i] / cs.length), [0, 0, 0]);
  const out = n[0] * (m[0] - from[0]) + n[1] * (m[1] - from[1]) + n[2] * (m[2] - from[2]) >= 0, k = out ? 1 : -1;
  return { corners: (out ? cs : [...cs].reverse()).map((c) => c.map(r5n)), normal: n.map((v) => r5n((k * v) / l)) };
};

/**
 * One piece in the land's frame: its stem from (x, y) along `a`, `len` long, its butt `r` thick; each joint over the
 * ground under it (resting on it, its radius up); its forks off the joints, one propped. → { faces, nodes: [[x, y]] }
 */
function piece(site, kind, x, y, a, len, r, seed) {
  const A = DEADFALL, K = A[kind], h = (q) => hash3(seed, q, 8501), N = 4, nodes = [], rs = [];
  // (the stem: a gentle bend side to side, its joints over the ground)
  let ang = a;
  for (let i = 0; i <= N; i++) {
    const t = i / N, prev = nodes[i - 1];
    if (i) ang += (h(10 + i) - 0.5) * 0.5;
    const px = i ? prev[0] + Math.cos(ang) * (len / N) : x, py = i ? prev[1] + Math.sin(ang) * (len / N) : y, rr = r * mix(1, A.taper, t);
    nodes.push([px, py, site.ground(px, py) + rr * 0.85]); rs.push(rr);
  }
  const faces = tube(nodes, rs, A.sides, true);
  // (its forks: off its inner joints, to either side in turn, the first propped up off the ground)
  const nf = K.forks[0] + Math.floor(h(30) * (K.forks[1] - K.forks[0] + 1));
  for (let f = 0; f < nf; f++) {
    const j = 1 + (f % (N - 1)), side = f % 2 ? 1 : -1, P = nodes[j], fa = a + side * mix(0.45, 0.9, h(40 + f)), fl = len * mix(0.28, 0.45, h(50 + f)), fr = rs[j] * 0.6;
    const pitch = f === 0 ? mix(A.prop[0], A.prop[1], h(60)) : 0, pts = [P], frs = [fr];
    for (let i = 1; i <= 2; i++) {
      const d = (fl * i) / 2, fx = P[0] + Math.cos(fa) * d * Math.cos(pitch), fy = P[1] + Math.sin(fa) * d * Math.cos(pitch);
      const z = pitch ? P[2] + Math.sin(pitch) * d : site.ground(fx, fy) + fr * mix(1, A.taper, i / 2) * 0.85;
      pts.push([fx, fy, z]); frs.push(fr * mix(1, A.taper, i / 2));
    }
    faces.push(...tube(pts, frs, A.sides, false));
    for (const p of pts.slice(1)) nodes.push(p);
  }
  return { faces: faces.map(face), nodes };
}

export function deadfall(site, { amount, trees = [], rocks = [], read = skandartRead(), seed = 1 }) {
  const A = DEADFALL, pieces = [], laws = [], row = (law, what, ok) => laws.push({ law, what, ok: !!ok });
  const inWalk = (x, y) => site.trailDist(x, y) < site.halfWAt(y) * A.edge;
  const inRock = (x, y) => rocks.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + 0.1);
  trees.forEach((t, ti) => {
    if (site.trailDist(t.x, t.y) > A.near) return;
    const h = (q) => hash3(seed, ti, 8601 + q), n = Math.round(A.most * amount * mix(0.4, 1.2, h(1)));
    for (let k = 0; k < n * 4 && pieces.filter((p) => p.tree === ti).length < n; k++) {
      const g = (q) => hash3(seed * 31 + ti, k, 8611 + q), kind = g(1) < A.limbs ? 'limb' : 'branch', K = A[kind];
      // (where it fell: under the crown, and pointing mostly out from the trunk)
      const d = t.crown * A.reach * Math.sqrt(g(2)), th = g(3) * 2 * Math.PI, x = t.x + Math.cos(th) * d, y = t.y + Math.sin(th) * d;
      const a = th + (g(4) - 0.5) * 1.6, len = mix(K.len[0], K.len[1], g(5)), r = mix(K.r[0], K.r[1], g(6));
      // (too thin to be read where it is seen: not made; a long thin stick reads by its length, at half the eye spot thick)
      if (len < read.least || 2 * r < read.least / 2) continue;
      const P = piece(site, kind, x, y, a, len, r, seed * 97 + ti * 13 + k);
      if (P.nodes.some(([px, py]) => inWalk(px, py) || inRock(px, py))) continue;
      if (pieces.some((q) => q.nodes.some(([qx, qy]) => P.nodes.some(([px, py]) => Math.hypot(px - qx, py - qy) < A.apart)))) continue;
      pieces.push({ tree: ti, kind, at: [r5n(x), r5n(y)], len: r5n(len), r, faces: P.faces, nodes: P.nodes });
    }
  });
  for (const p of pieces) {
    const id = `tree ${p.tree}'s ${p.kind} at ${p.at.join(', ')}`;
    row('off-the-walk', `${id}: no part of it in the walk's middle`, !p.nodes.some(([x, y]) => inWalk(x, y)));
    row('too-small-to-read', `${id}: ${r5(2 * p.r)} m thick, ${p.len} m long (the eye spot ${r5(read.least)} m)`, p.len >= read.least && 2 * p.r >= read.least / 2);
  }
  row('placed', `${pieces.length} fallen (${pieces.filter((p) => p.kind === 'limb').length} limbs)`, pieces.length > 0);
  // (the grass kept off only where the wood lies, so it lies in the grass, not in a strip cut for it)
  const claims = pieces.flatMap((p) => p.nodes.map(([x, y]) => [r5n(x), r5n(y), r5n(p.r * 1.5)]));
  return { pieces: pieces.map(({ nodes: _n, r: _r, ...p }) => p), laws, claims };
}
